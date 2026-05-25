const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_STORE_PATH = path.join(os.homedir(), ".openx-mirror-agent.json");

function createDefaultState() {
  return {
    machineId: crypto.randomUUID(),
    machineName: os.hostname(),
    folders: [],
    clients: []
  };
}

function loadStore(filePath = DEFAULT_STORE_PATH) {
  if (!fs.existsSync(filePath)) {
    return createDefaultState();
  }
  return { ...createDefaultState(), ...JSON.parse(fs.readFileSync(filePath, "utf8")) };
}

function saveStore(state, filePath = DEFAULT_STORE_PATH) {
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

module.exports = {
  DEFAULT_STORE_PATH,
  loadStore,
  saveStore
};
