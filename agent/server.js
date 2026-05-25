#!/usr/bin/env node
const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { loadStore, saveStore } = require("./store");
const { isStaticFile, normalizeAllowedFolder, resolveInside } = require("./security");

const args = parseArgs(process.argv.slice(2));
const port = Number(args.port || process.env.OPENX_MIRROR_PORT || 8787);
const host = args.host || process.env.OPENX_MIRROR_HOST || "0.0.0.0";
const storePath = args.store || process.env.OPENX_MIRROR_STORE;
const state = loadStore(storePath);
let pairing = createPairingCode();

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        machineId: state.machineId,
        machineName: state.machineName,
        pairingExpiresAt: pairing.expiresAt
      });
    }

    if (req.method === "GET" && url.pathname === "/pairing-code") {
      return sendJson(res, 200, {
        code: pairing.code,
        expiresAt: pairing.expiresAt
      });
    }

    if (req.method === "POST" && url.pathname === "/pair") {
      const body = await readJson(req);
      if (!pairing || Date.now() > pairing.expiresAtMs || body.code !== pairing.code) {
        return sendJson(res, 401, { error: "Invalid or expired pairing code." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      state.clients.push({
        id: crypto.randomUUID(),
        name: body.clientName || "OpenX Dashboard",
        tokenHash: hashToken(token),
        pairedAt: new Date().toISOString()
      });
      pairing = createPairingCode();
      saveStore(state, storePath);
      return sendJson(res, 200, {
        machineId: state.machineId,
        machineName: state.machineName,
        accessToken: token,
        expiresAt: null
      });
    }

    const auth = authenticate(req);
    if (!auth.ok) return sendJson(res, 401, { error: "Missing or invalid bearer token." });

    if (req.method === "GET" && url.pathname === "/folders") {
      return sendJson(res, 200, { folders: state.folders });
    }

    if (req.method === "POST" && url.pathname === "/folders") {
      const folder = await readJson(req);
      const normalized = normalizeAllowedFolder(folder.path);
      state.folders.push({
        id: crypto.randomUUID(),
        name: folder.name || path.basename(normalized),
        path: normalized,
        recursive: folder.recursive !== false
      });
      saveStore(state, storePath);
      return sendJson(res, 200, { folders: state.folders });
    }

    const folderMatch = url.pathname.match(/^\/folders\/([^/]+)$/);
    if (folderMatch && (req.method === "PUT" || req.method === "DELETE")) {
      const folderId = decodeURIComponent(folderMatch[1]);
      const index = state.folders.findIndex((folder) => folder.id === folderId);
      if (index === -1) return sendJson(res, 404, { error: "Folder not found." });
      if (req.method === "DELETE") {
        state.folders.splice(index, 1);
      } else {
        const body = await readJson(req);
        const normalized = normalizeAllowedFolder(body.path);
        state.folders[index] = {
          ...state.folders[index],
          name: body.name || path.basename(normalized),
          path: normalized,
          recursive: body.recursive !== false
        };
      }
      saveStore(state, storePath);
      return sendJson(res, 200, { folders: state.folders });
    }

    const scanMatch = url.pathname.match(/^\/scan\/([^/]+)$/);
    if (scanMatch && req.method === "GET") {
      const folder = findFolder(decodeURIComponent(scanMatch[1]));
      if (!folder) return sendJson(res, 404, { error: "Folder not found." });
      return sendJson(res, 200, { files: scanFolder(folder) });
    }

    const fileMatch = url.pathname.match(/^\/file\/([^/]+)\/(.+)$/);
    if (fileMatch && req.method === "GET") {
      const folder = findFolder(decodeURIComponent(fileMatch[1]));
      if (!folder) return sendJson(res, 404, { error: "Folder not found." });
      const relativePath = decodeURIComponent(fileMatch[2]);
      const fullPath = resolveInside(folder.path, relativePath);
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        return sendJson(res, 404, { error: "File not found." });
      }
      if (!isStaticFile(fullPath)) {
        return sendJson(res, 403, { error: "File type is not allowed." });
      }
      res.writeHead(200, {
        "Content-Type": contentType(fullPath),
        "Cache-Control": "no-store"
      });
      return fs.createReadStream(fullPath).pipe(res);
    }

    if (req.method === "POST" && url.pathname === "/revoke") {
      const token = bearerToken(req);
      state.clients = state.clients.filter((client) => client.tokenHash !== hashToken(token));
      saveStore(state, storePath);
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`OpenX Mirror agent: http://${host}:${port}`);
  console.log(`Machine: ${state.machineName} (${state.machineId})`);
  console.log(`Pairing code: ${pairing.code}`);
  console.log(`Expires: ${pairing.expiresAt}`);
});

function parseArgs(input) {
  const output = {};
  for (let i = 0; i < input.length; i += 1) {
    if (input[i].startsWith("--")) {
      output[input[i].slice(2)] = input[i + 1];
      i += 1;
    }
  }
  return output;
}

function createPairingCode() {
  const number = crypto.randomInt(100000, 999999).toString();
  const expiresAtMs = Date.now() + 5 * 60 * 1000;
  return {
    code: `${number.slice(0, 3)}-${number.slice(3)}`,
    expiresAtMs,
    expiresAt: new Date(expiresAtMs).toISOString()
  };
}

function authenticate(req) {
  const token = bearerToken(req);
  if (!token) return { ok: false };
  const tokenHash = hashToken(token);
  return { ok: state.clients.some((client) => client.tokenHash === tokenHash) };
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function findFolder(folderId) {
  return state.folders.find((folder) => folder.id === folderId);
}

function scanFolder(folder) {
  const files = [];
  walk(folder.path, "", folder.recursive !== false, files, folder);
  return files;
}

function walk(rootPath, relativeRoot, recursive, files, folder) {
  const current = path.join(rootPath, relativeRoot);
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const relativePath = path.join(relativeRoot, entry.name);
    if (entry.isDirectory() && recursive) {
      walk(rootPath, relativePath, recursive, files, folder);
      continue;
    }
    if (entry.isFile() && isStaticFile(entry.name)) {
      files.push({
        folderId: folder.id,
        folderName: folder.name,
        name: entry.name,
        relativePath: relativePath.split(path.sep).join("/")
      });
    }
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(status === 204 ? "" : JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html" || extension === ".htm") return "text/html; charset=utf-8";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".md" || extension === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}
