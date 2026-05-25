#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const command = process.argv[2] || "help";
const args = process.argv.slice(3);

const commands = {
  agent: {
    description: "Run the local LAN sharing agent",
    script: path.join(rootDir, "agent", "server.js")
  }
};

if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "version" || command === "--version" || command === "-v") {
  const pkg = require(path.join(rootDir, "package.json"));
  console.log(pkg.version);
  process.exit(0);
}

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

const child = spawn(process.execPath, [commands[command].script, ...args], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});

function printHelp() {
  console.log(`OpenX Mirror

Usage:
  openx agent [--host 0.0.0.0] [--port 8787] [--store ./agent.json]
  openx help
  openx version

Commands:
  agent    ${commands.agent.description}

Examples:
  npx openx-mirror agent
  npx openx-mirror agent --host 0.0.0.0 --port 8787
`);
}
