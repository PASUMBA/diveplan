"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const crypto = require("node:crypto");
const { execFile, spawn } = require("node:child_process");
const mission = require("./mission.js");

const boardType = "esp32:esp32:esp32";
const defaultPort = 48736;
const assetTypes = new Map([
  ["/index.html", "text/html; charset=utf-8"],
  ["/style.css", "text/css; charset=utf-8"],
  ["/app.js", "text/javascript; charset=utf-8"],
  ["/mission.js", "text/javascript; charset=utf-8"],
  ["/scene.js", "text/javascript; charset=utf-8"]
]);

function findArduinoCli() {
  const executable = process.platform === "win32" ? "arduino-cli.exe" : "arduino-cli";
  const folders = (process.env.PATH || "").split(path.delimiter);
  if (process.platform === "win32") {
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) {
      folders.push(path.join(base, "Arduino PLC IDE Tools"));
      folders.push(path.join(base, "Arduino IDE", "resources", "app", "lib", "backend", "resources"));
    }
  }
  for (const folder of folders) {
    if (!folder || !path.isAbsolute(folder)) continue;
    const candidate = path.join(folder, executable);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch { /* Try the next install location. */ }
  }
  return null;
}

function runCli(executable, args, timeout, stdoutOnly = false) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const log = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
        if (error) {
          const reason = error.killed ? "Arduino CLI timed out." : "Arduino CLI failed.";
          reject(new Error(reason + "\n" + (log || error.message)));
        } else {
          resolve(stdoutOnly ? stdout : log);
        }
      });
  });
}

// A serial bridge identifies its USB adapter. The operator still selects the attached ESP32.
function espPorts(discovery) {
  const ports = [];
  for (const device of discovery.detected_ports || []) {
    const port = device.port || {};
    const address = String(port.address || "").toUpperCase();
    if (port.protocol !== "serial" || !/^COM[1-9]\d*$/.test(address)) continue;
    const properties = port.properties || {};
    const vid = String(properties.vid || "").toUpperCase().replace(/^0X/, "");
    const pid = String(properties.pid || "").toUpperCase().replace(/^0X/, "");
    const names = (device.matching_boards || []).map(board => board.name || "").join(" / ");
    const label = [port.label, port.hardware_id, names].filter(Boolean).join(" ");
    if (/pixhawk|ardupilot|ardusub|cubepilot|px4|flight.controller/i.test(label)) continue;
    if (["26AC", "2DAE", "3162"].includes(vid)) continue;
    let family;
    if (vid === "303A" || /\bESP32\b|Espressif/i.test(names)) family = "Espressif ESP32";
    else if (vid === "10C4" && ["EA60", "EA70", "EA71"].includes(pid)) family = "CP210x USB UART";
    else if (vid === "1A86" && ["7523", "5523", "55D3", "55D4"].includes(pid)) family = "CH34x/CH91xx USB UART";
    else if (vid === "0403" && ["6001", "6010", "6011", "6014", "6015"].includes(pid)) family = "FTDI USB UART";
    else if (!vid && /CP210|CH34|CH91|FTDI/i.test(port.label || "")) family = port.label;
    if (!family) continue;
    const serial = properties.serialNumber || properties.serial_number || port.serial_number || "";
    ports.push({ port: address, label: address + " · " + family, identity: [vid, pid, serial, family].join("/") });
  }
  return ports.sort((a, b) => Number(a.port.slice(3)) - Number(b.port.slice(3)));
}

async function discoverPorts(cli) {
  const output = await runCli(cli, ["board", "list", "--json"], 20000, true);
  return espPorts(JSON.parse(output));
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  });
  res.end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readRequest(req) {
  const parts = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32768) throw new Error("The request exceeds the 32 KB mission limit.");
    parts.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(parts).toString("utf8")); }
  catch { throw new Error("Send a valid JSON mission."); }
}

function createDiveServer({ cli = findArduinoCli(), listPorts = discoverPorts, run = runCli } = {}) {
  const token = crypto.randomBytes(24).toString("hex");
  let building = false;
  let jobDir;
  let tempRoot;

  async function doBuild(request) {
    let target;
    if (request.action === "upload") {
      const initial = await listPorts(cli);
      target = initial.find(item => item.port === request.port);
      if (!target) throw new Error("Select a connected ESP32 USB adapter and refresh the ports.");
    }
    const source = mission.generate(request.steps, request.mode);
    if (!jobDir) {
      tempRoot = await fs.promises.realpath(os.tmpdir());
      jobDir = await fs.promises.mkdtemp(path.join(tempRoot, "diveplan-build-"));
    }
    const sketch = path.join(jobDir, "AuvMission");
    const build = path.join(jobDir, "build");
    await fs.promises.mkdir(sketch, { recursive: true });
    const file = path.join(sketch, "AuvMission.ino");
    let previous;
    try { previous = await fs.promises.readFile(file, "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (source !== previous) await fs.promises.writeFile(file, source, "utf8");
    const compileLog = await run(cli, ["compile", "--fqbn", boardType, "--build-path", build, sketch], 600000);
    if (!target) return compileLog || "Sketch verified.";
    const current = await listPorts(cli);
    if (!current.some(item => item.port === target.port && item.identity === target.identity)) {
      throw new Error("The selected adapter changed during compilation. Refresh the ports and select the ESP32 again.");
    }
    const uploadLog = await run(cli, ["upload", "--port", target.port, "--fqbn", boardType,
      "--input-dir", build, sketch], 240000);
    return compileLog + "\n" + (uploadLog || "ESP32 upload completed.");
  }

  const server = http.createServer({ requestTimeout: 20000, headersTimeout: 10000 }, async (req, res) => {
    const expectedHost = "127.0.0.1:" + server.address().port;
    const origin = "http://" + expectedHost;
    const fail = (status, message) => send(res, status, { ok: false, log: message });
    if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== origin)) {
      return fail(403, "Use the local DivePlan address shown by the launcher.");
    }
    const route = (req.url || "").split("?")[0];
    try {
      if (req.method === "GET" && (route === "/" || assetTypes.has(route))) {
        const asset = route === "/" ? "/index.html" : route;
        const contents = await fs.promises.readFile(path.join(__dirname, asset.slice(1)));
        return send(res, 200, contents, assetTypes.get(asset));
      }
      if (route.startsWith("/api/") && req.headers["sec-fetch-site"] === "cross-site") {
        return fail(403, "Open DivePlan to access its local tools.");
      }
      if (req.method === "GET" && route === "/api/identity") {
        return send(res, 200, { app: "DivePlan" });
      }
      if (req.method === "GET" && route === "/api/info") {
        let ports = [];
        let detail = cli ? "Arduino CLI is available." : "Install Arduino CLI to verify or upload from DivePlan.";
        if (cli) {
          try { ports = await listPorts(cli); }
          catch (error) { detail = "Port discovery failed. " + error.message; }
        }
        return send(res, 200, { canBuild: Boolean(cli), detail, token, ports: ports.map(({ port, label }) => ({ port, label })) });
      }
      if (req.method === "POST" && route === "/api/build") {
        if (req.headers.origin !== origin || req.headers["x-diveplan-token"] !== token) {
          return fail(403, "Refresh DivePlan and retry from this window.");
        }
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
          return fail(415, "A JSON mission is required.");
        }
        if (Number(req.headers["content-length"]) > 32768) return fail(413, "The mission exceeds 32 KB.");
        let request;
        try { request = await readRequest(req); }
        catch (error) { return fail(400, error.message); }
        if (!request || !["verify", "upload"].includes(request.action)) return fail(400, "Select Verify or Upload.");
        const invalid = mission.validate(request.steps, request.mode);
        if (invalid) return fail(400, invalid);
        if (Object.keys(request).some(key => !["steps", "mode", "action", "port"].includes(key))) {
          return fail(400, "Only mission steps, mode, action, and the selected port are accepted.");
        }
        if (request.action === "upload" && (typeof request.port !== "string" || !/^COM[1-9]\d*$/.test(request.port))) {
          return fail(400, "Select the ESP32 USB port before upload.");
        }
        if (!cli) return fail(503, "Arduino CLI is unavailable. Open the exported sketch in Arduino IDE or install Arduino CLI.");
        if (building) return fail(409, "Another build is in progress.");
        building = true;
        try { return send(res, 200, { ok: true, log: (await doBuild(request)).slice(-64000) }); }
        catch (error) { return fail(422, error.message.slice(-64000)); }
        finally { building = false; }
      }
      return fail(404, "Unknown local resource.");
    } catch (error) {
      return fail(500, error.message);
    }
  });
  // Remove only this process's mkdtemp directory after the HTTP server has stopped.
  server.on("close", () => {
    if (jobDir && !building && path.dirname(path.resolve(jobDir)) === tempRoot &&
        /^diveplan-build-[a-zA-Z0-9]{6}$/.test(path.basename(jobDir))) {
      fs.rmSync(jobDir, { recursive: true, force: true, maxRetries: 2 });
    }
  });
  return server;
}

function openBrowser(url) {
  if (process.platform !== "win32") return;
  const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
    detached: true, stdio: "ignore", windowsHide: true
  });
  browser.on("error", () => console.log("Open " + url + " in your browser."));
  browser.unref();
}

async function start() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf("--port");
  const port = portIndex < 0 ? defaultPort : Number(args[portIndex + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Use a port between 0 and 65535.");
  const server = createDiveServer();
  server.on("error", async error => {
    if (error.code === "EADDRINUSE") {
      const url = "http://127.0.0.1:" + port + "/";
      try {
        const response = await fetch(url + "api/identity", { signal: AbortSignal.timeout(1200), redirect: "error" });
        if (response.ok && (await response.text()) === '{"app":"DivePlan"}') {
          console.log("DivePlan is already running at " + url);
          if (!args.includes("--no-browser")) openBrowser(url);
          return;
        }
      } catch { /* The occupied port belongs to a different program. */ }
      console.error("Port " + port + " is already in use. If DivePlan is open, use its existing window.");
    } else console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    const url = "http://127.0.0.1:" + server.address().port + "/";
    console.log("DivePlan is running at " + url + "\nKeep this window open while using the app. Press Ctrl+C to close it.");
    if (!args.includes("--no-browser")) openBrowser(url);
  });
  process.once("SIGINT", () => server.close());
  process.once("SIGTERM", () => server.close());
}

if (require.main === module) start().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createDiveServer, espPorts };
