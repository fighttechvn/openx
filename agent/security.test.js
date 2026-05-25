const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { isStaticFile, normalizeAllowedFolder, resolveInside } = require("./security");

test("normalizeAllowedFolder accepts an existing directory", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "openx-mirror-"));
  assert.equal(normalizeAllowedFolder(folder), fs.realpathSync(folder));
});

test("resolveInside blocks traversal outside allowed root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openx-mirror-root-"));
  assert.throws(() => resolveInside(root, "../secret.html"), /outside/);
});

test("isStaticFile allows static report types only", () => {
  assert.equal(isStaticFile("e2e.html"), true);
  assert.equal(isStaticFile("srs.pdf"), true);
  assert.equal(isStaticFile("screenshots/home.png"), true);
  assert.equal(isStaticFile("assets/app.js"), true);
  assert.equal(isStaticFile("token.env"), false);
});
