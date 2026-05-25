const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

test("file tickets open static files and localhost auto-pair redirects to dashboard", async (t) => {
  let port;
  try {
    port = await getFreePort();
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("TCP listen is not permitted in this sandbox.");
      return;
    }
    throw error;
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openx-agent-integration-"));
  const storePath = path.join(tempDir, "agent.json");
  const reportDir = path.join(tempDir, "reports");
  fs.mkdirSync(path.join(reportDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(reportDir, "index.html"), "<!doctype html><script src=\"assets/app.js\"></script>");
  fs.writeFileSync(path.join(reportDir, "assets", "app.js"), "window.reportLoaded = true;");
  fs.writeFileSync(path.join(reportDir, "secret.env"), "TOKEN=secret");

  const child = spawn(process.execPath, [
    path.join(__dirname, "server.js"),
    "--host", "127.0.0.1",
    "--port", String(port),
    "--store", storePath,
    "--dashboard-url", "http://localhost:8080/",
    "--deployed-dashboard-url", "https://example.test/openx/"
  ], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(() => child.kill());

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl);

  const pairing = await jsonFetch(`${baseUrl}/pairing-code`);
  const pair = await jsonFetch(`${baseUrl}/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: pairing.code,
      clientName: "Integration Test"
    })
  });
  assert.ok(pair.accessToken);

  const authHeaders = {
    Authorization: `Bearer ${pair.accessToken}`,
    "Content-Type": "application/json"
  };
  const folders = await jsonFetch(`${baseUrl}/folders`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Reports",
      path: reportDir
    })
  });
  const folderId = folders.folders[0].id;

  const directFile = await fetch(`${baseUrl}/file/${folderId}/index.html`);
  assert.equal(directFile.status, 401);

  const ticket = await jsonFetch(`${baseUrl}/file-ticket`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      folderId,
      relativePath: "index.html"
    })
  });
  assert.match(ticket.url, /\/file\/.+\/index\.html\?ticket=/);

  const openedFile = await fetch(ticket.url, { redirect: "manual" });
  assert.equal(openedFile.status, 200);
  assert.match(openedFile.headers.get("content-type"), /^text\/html/);
  const cookie = openedFile.headers.get("set-cookie");
  assert.match(cookie, /openx_file_session=/);

  const asset = await fetch(`${baseUrl}/file/${folderId}/assets/app.js`, {
    headers: { Cookie: cookie.split(";")[0] }
  });
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type"), /^text\/javascript/);

  const disallowed = await jsonFetch(`${baseUrl}/file-ticket`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      folderId,
      relativePath: "secret.env"
    })
  }, 403);
  assert.equal(disallowed.error, "File type is not allowed.");

  const autoPair = await fetch(`${baseUrl}/pair-dashboard?target=deploy`, { redirect: "manual" });
  assert.equal(autoPair.status, 302);
  const location = autoPair.headers.get("location");
  assert.ok(location.startsWith("https://example.test/openx/#openxPair="));
});

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (_error) {
      await delay(50);
    }
  }
  throw new Error("Agent did not become healthy.");
}

async function jsonFetch(url, options = {}, expectedStatus = 200) {
  const response = await fetch(url, options);
  const data = await response.json();
  assert.equal(response.status, expectedStatus);
  return data;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
