const fs = require("fs");
const path = require("path");

const STATIC_FILE_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".pdf",
  ".txt",
  ".md",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2"
]);

function normalizeAllowedFolder(folderPath) {
  if (!folderPath || typeof folderPath !== "string") {
    throw new Error("Folder path is required.");
  }
  const resolved = fs.realpathSync(folderPath);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error("Path is not a directory.");
  }
  return resolved;
}

function resolveInside(rootPath, relativePath) {
  const root = fs.realpathSync(rootPath);
  const target = path.resolve(root, relativePath || ".");
  const targetParent = fs.existsSync(target) ? fs.realpathSync(target) : fs.realpathSync(path.dirname(target));
  const comparableRoot = root.endsWith(path.sep) ? root : root + path.sep;
  const comparableTarget = targetParent.endsWith(path.sep) ? targetParent : targetParent + path.sep;
  if (targetParent !== root && !comparableTarget.startsWith(comparableRoot)) {
    throw new Error("Requested path is outside the allowed folder.");
  }
  return target;
}

function isStaticFile(fileName) {
  return STATIC_FILE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

module.exports = {
  isStaticFile,
  normalizeAllowedFolder,
  resolveInside
};
