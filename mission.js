/* Dive Plan mission model and ESP32 sketch export. Works in a browser or Node.js. */
(function () {
  "use strict";

  const modes = Object.freeze({STABILIZE: 0, MANUAL: 19, ACRO: 1});
  // Assumed full-input turn rate for previewing yaw movements.
  const nominalYawRateDegPerSecond = 90;
  const previewYawRate = nominalYawRateDegPerSecond * Math.PI / 180;
  const moves = Object.freeze({
    forward:  Object.freeze({label: "Forward",  seconds: 3, power: 30, x:  1, y:  0, z:  0}),
    backward: Object.freeze({label: "Backward", seconds: 3, power: 30, x: -1, y:  0, z:  0}),
    right:    Object.freeze({label: "Right",    seconds: 3, power: 30, x:  0, y:  1, z:  0}),
    left:     Object.freeze({label: "Left",     seconds: 3, power: 30, x:  0, y: -1, z:  0}),
    up:       Object.freeze({label: "Up",       seconds: 2, power: 50, x:  0, y:  0, z:  1}),
    down:     Object.freeze({label: "Down",     seconds: 2, power: 50, x:  0, y:  0, z: -1}),
    yawRight: Object.freeze({label: "Rotate right", seconds: 2, power: 30, x: 0, y: 0, z: 0, yaw: 1}),
    yawLeft:  Object.freeze({label: "Rotate left",  seconds: 2, power: 30, x: 0, y: 0, z: 0, yaw: -1}),
    spinRight: Object.freeze({label: "Full turn right", seconds: 30, power: 30, x: 0, y: 0, z: 0, yaw: 1, fullTurn: true}),
    spinLeft:  Object.freeze({label: "Full turn left",  seconds: 30, power: 30, x: 0, y: 0, z: 0, yaw: -1, fullTurn: true}),
    hold:     Object.freeze({label: "Hold",     seconds: 2, power:  0, x:  0, y:  0, z:  0})
  });

  function defaults() {
    return ["forward", "down", "backward", "up"].map(move => ({
      move, seconds: moves[move].seconds, power: moves[move].power
    }));
  }

  function validate(steps, mode = "STABILIZE") {
    if (typeof mode !== "string" || !Object.prototype.hasOwnProperty.call(modes, mode)) {
      return "Select STABILIZE, MANUAL, or ACRO for the sequence.";
    }
    if (!Array.isArray(steps)) return "The sequence must be a list of movements.";
    if (!steps.length) return "Add a movement before generating a sketch.";
    if (steps.length > 100) return "A sequence can contain up to 100 movements.";

    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      const name = "Step " + (index + 1);
      if (!step || typeof step.move !== "string" ||
          !Object.prototype.hasOwnProperty.call(moves, step.move)) {
        return name + " needs a supported movement.";
      }
      if (!Number.isFinite(step.seconds) || step.seconds < 0.1 || step.seconds > 600 ||
          Math.round(step.seconds * 10) / 10 !== step.seconds) {
        const timeLabel = moves[step.move].fullTurn ? "maximum turn time" : "duration";
        return name + " needs a " + timeLabel + " from 0.1 to 600 seconds in tenths of a second.";
      }
      if (step.move === "hold") {
        if (step.power !== 0) return name + " must use 0% pilot input for a neutral hold.";
      } else if (!Number.isFinite(step.power) || step.power < 1 || step.power > 100) {
        return name + " needs a pilot input from 1% to 100%.";
      }
    }
    return null;
  }

  function trajectory(steps) {
    const points = [{x: 0, y: 0, z: 0, t: 0, heading: 0}];
    if (Array.isArray(steps) && steps.length === 0) return {points, duration: 0};
    const problem = validate(steps);
    if (problem) throw new Error(problem);

    // Integrate pilot input in relative units. Timed inputs cannot predict travel in metres.
    let elapsedMs = 0;
    for (const step of steps) {
      const direction = moves[step.move];
      if (direction.fullTurn) {
        const estimatedTurnSeconds = 360 / (nominalYawRateDegPerSecond * step.power / 100);
        elapsedMs += Math.round(estimatedTurnSeconds * 10) * 100;
      } else {
        elapsedMs += Math.round(step.seconds * 1000);
      }
      const distance = step.seconds * step.power / 100;
      const yawDistance = direction.fullTurn ? 2 * Math.PI : distance * previewYawRate;
      const previous = points[points.length - 1];
      const cos = Math.cos(previous.heading);
      const sin = Math.sin(previous.heading);
      points.push({
        x: previous.x + (cos * direction.x - sin * direction.y) * distance,
        y: previous.y + (sin * direction.x + cos * direction.y) * distance,
        z: previous.z + direction.z * distance,
        t: elapsedMs / 1000,
        heading: previous.heading + (direction.yaw || 0) * yawDistance
      });
    }
    return {points, duration: elapsedMs / 1000};
  }

  function validateOptions(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      return "Run settings must be an object.";
    }
    const startControl = options.startControl === undefined
      ? (options.autoStart === undefined ? "web" : options.autoStart ? "boot" : "web")
      : options.startControl;
    const repeatIntervalSeconds = options.repeatIntervalSeconds === undefined ? 20 : options.repeatIntervalSeconds;
    const repeatEnabled = options.repeatEnabled === undefined ? true : options.repeatEnabled;
    const startupDelaySeconds = options.startupDelaySeconds === undefined ? 10 : options.startupDelaySeconds;
    const apSsid = options.apSsid === undefined ? "DivePlan-AUV" : options.apSsid;
    const apPassword = options.apPassword === undefined ? "DivePlan-Start26" : options.apPassword;
    if (startControl !== "web" && startControl !== "boot") return "Select hotspot button or automatic boot start.";
    if (typeof repeatEnabled !== "boolean") return "Repeat mode must be on or off.";
    if (!Number.isInteger(repeatIntervalSeconds) || repeatIntervalSeconds < 1 || repeatIntervalSeconds > 3600) {
      return "Repeat interval must be a whole number from 1 to 3600 seconds.";
    }
    if (!Number.isInteger(startupDelaySeconds) || startupDelaySeconds < 0 || startupDelaySeconds > 120) {
      return "Pixhawk startup delay must be a whole number from 0 to 120 seconds.";
    }
    if (typeof apSsid !== "string" || !/^[A-Za-z0-9_-]{1,31}$/.test(apSsid)) {
      return "Hotspot name must be 1 to 31 letters, numbers, hyphens, or underscores.";
    }
    if (typeof apPassword !== "string" || !/^[A-Za-z0-9_-]{8,63}$/.test(apPassword)) {
      return "Hotspot password must be 8 to 63 letters, numbers, hyphens, or underscores.";
    }
    return null;
  }

  function generate(steps, mode = "STABILIZE", options = {}) {
    const problem = validate(steps, mode) || validateOptions(options);
    if (problem) throw new Error(problem);
    const startControl = options.startControl === undefined
      ? (options.autoStart === undefined ? "web" : options.autoStart ? "boot" : "web")
      : options.startControl;
    const autoStart = startControl === "boot";
    const repeatIntervalSeconds = options.repeatIntervalSeconds === undefined ? 20 : options.repeatIntervalSeconds;
    const repeatEnabled = options.repeatEnabled === undefined ? true : options.repeatEnabled;
    const startupDelaySeconds = options.startupDelaySeconds === undefined ? 10 : options.startupDelaySeconds;
    const apSsid = options.apSsid === undefined ? "DivePlan-AUV" : options.apSsid;
    const apPassword = options.apPassword === undefined ? "DivePlan-Start26" : options.apPassword;
    const lines = steps.map(({move, seconds, power}) => {
      const direction = moves[move];
      const horizontalInput = Math.round(power * 10);
      const surge = direction.x * horizontalInput;
      const sway = direction.y * horizontalInput;
      const heave = 500 + direction.z * Math.round(power * 5);
      const yaw = (direction.yaw || 0) * horizontalInput;
      const durationMs = Math.round(seconds * 1000);
      return `  {"${move}", ${durationMs}, ${surge}, ${sway}, ${heave}, ${yaw}${direction.fullTurn ? ", true" : ""}},`;
    });
    return firmwareTemplate.replace("@@DIVEPLAN_MISSION_MODE@@", String(modes[mode]))
      .replace("@@DIVEPLAN_MISSION_HAS_FULL_TURN@@", String(steps.some(step => moves[step.move].fullTurn)))
      .replace("@@DIVEPLAN_AUTO_START@@", String(autoStart))
      .replace("@@DIVEPLAN_REPEAT_INTERVAL_MS@@", String(repeatIntervalSeconds * 1000))
      .replace("@@DIVEPLAN_REPEAT_ENABLED@@", String(repeatEnabled))
      .replace("@@DIVEPLAN_PIXHAWK_STARTUP_DELAY_MS@@", String(startupDelaySeconds * 1000))
      .replace("@@DIVEPLAN_AP_SSID@@", apSsid)
      .replace("@@DIVEPLAN_AP_PASSWORD@@", apPassword)
      .replace("@@DIVEPLAN_MISSION_LEGS@@", lines.join("\n"));
  }

  // Keep the tested controller state machine with the portable offline generator.
  const firmwareTemplate = String.raw`// Generated by Dive Plan. Use an ESP32 Dev Module with the MAVLink Arduino library.
// Automatic mode waits for a fresh, disarmed ArduSub heartbeat, runs kLegs, then
// waits kRepeatIntervalMs after confirmed disarm before the next run.
// prepare and start use kMissionMode. The independent up and up10 commands use STABILIZE.
// For a full-turn leg, durationMs is a deadline and yaw is the maximum signed input.
#include <Arduino.h>
#include <MAVLink_ardupilotmega.h>
#include <WiFi.h>
#include <WebServer.h>
#include <esp_system.h>
#include <math.h>

namespace {
constexpr int kPixhawkRx = 16;
constexpr int kPixhawkTx = 17;
constexpr uint32_t kPixhawkBaud = 57600;
constexpr uint32_t kConsoleBaud = 115200;
constexpr uint8_t kPilotSystem = 255;
constexpr uint8_t kPilotComponent = MAV_COMP_ID_ONBOARD_COMPUTER;
constexpr uint32_t kStabilizeMode = 0;
constexpr uint32_t kMissionMode = @@DIVEPLAN_MISSION_MODE@@;
constexpr bool kMissionHasFullTurn = @@DIVEPLAN_MISSION_HAS_FULL_TURN@@;
constexpr bool kAutoStart = @@DIVEPLAN_AUTO_START@@;
constexpr bool kRepeatEnabled = @@DIVEPLAN_REPEAT_ENABLED@@;
constexpr uint32_t kRepeatIntervalMs = @@DIVEPLAN_REPEAT_INTERVAL_MS@@;
constexpr uint32_t kPixhawkStartupDelayMs = @@DIVEPLAN_PIXHAWK_STARTUP_DELAY_MS@@;
constexpr char kApSsid[] = "@@DIVEPLAN_AP_SSID@@";
constexpr char kApPassword[] = "@@DIVEPLAN_AP_PASSWORD@@";
constexpr uint32_t kHeartbeatInterval = 1000;
constexpr uint32_t kHeartbeatTimeout = 2500;
constexpr uint32_t kPilotInterval = 50;
constexpr uint32_t kMaxPilotGap = 250;
constexpr uint32_t kCommandTimeout = 4000;
constexpr uint32_t kRetryInterval = 500;
constexpr uint32_t kOriginWait = 700;
constexpr uint32_t kAttitudeIntervalMicros = 50000;
constexpr uint32_t kAttitudeTimeout = 350;
constexpr int16_t kNeutralHeave = 500;
constexpr float kPi = 3.1415926535897932f;
constexpr float kFullTurn = 2.0f * kPi;
constexpr float kYawTolerance = kPi / 36.0f;  // 5 degrees
constexpr float kYawSlowdown = kPi / 2.0f;   // Last 90 degrees
constexpr float kMaxYawSampleDelta = kPi / 2.0f;
constexpr int16_t kYawTaperFloor = 120;      // 12% input, capped by the selected input
constexpr char kPilotActionParameter[16] = "FS_PILOT_INPUT";
constexpr char kPilotTimeoutParameter[] = "FS_PILOT_TIMEOUT";

struct Leg {
  const char *name;
  uint32_t durationMs;
  int16_t surge;
  int16_t sway;
  int16_t heave;
  int16_t yaw;
  bool fullTurn;
};

constexpr Leg kUpLeg{"up", 2000, 0, 0, 750, 0};
constexpr Leg kUp10Leg{"up", 10000, kUpLeg.surge, kUpLeg.sway, kUpLeg.heave, kUpLeg.yaw};
constexpr Leg kLegs[] = {
@@DIVEPLAN_MISSION_LEGS@@
};
constexpr size_t kLegCount = sizeof(kLegs) / sizeof(kLegs[0]);

WebServer controlWebServer(80);
const char kControlPage[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#10272e"><title>DivePlan AUV Control</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#edf3f2;color:#172e34;font:16px system-ui,Segoe UI,Arial,sans-serif}.wrap{max-width:520px;margin:0 auto;padding:20px}.card{background:#fff;border:1px solid #d2dcde;border-radius:14px;padding:20px;box-shadow:0 6px 24px #10262d12}.brand{font-size:13px;letter-spacing:.12em;color:#087b72;font-weight:800}.status{margin:18px 0;padding:14px;border-radius:9px;background:#f1f6f5;line-height:1.5}.state{font-weight:750;font-size:19px}.detail{color:#526b71;font-size:14px}.buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}button{border:0;border-radius:9px;padding:15px 12px;color:#fff;font-size:16px;font-weight:750;cursor:pointer;min-height:54px}button:disabled{opacity:.45;cursor:not-allowed}#start{background:#087b72}#stop{background:#aa3b32}.note{font-size:13px;line-height:1.5;color:#50656a}.message{min-height:22px;font-size:14px;font-weight:650;color:#205b52}.footer{font-size:12px;color:#6c7f83;margin-top:18px}@media(max-width:390px){.wrap{padding:12px}.card{padding:16px}.buttons{grid-template-columns:1fr}}
</style></head><body><main class="wrap"><section class="card">
<div class="brand">DIVEPLAN · AUV</div><h1>Mission control</h1>
<div class="status"><div id="state" class="state">Connecting…</div><div id="detail" class="detail">Reading Pixhawk status</div></div>
<div class="buttons"><button id="start" type="button">Start sequence</button><button id="stop" type="button">Stop</button></div>
<div id="message" class="message" role="status"></div>
<p class="note" id="repeat-note">After starting, the sequence repeats after each successful run. Press Stop to end it.</p>
<p class="note">Wi-Fi cannot reach the ESP32 underwater. Start while the vehicle is out of the water; the mission continues onboard after the phone loses connection. Stop requires Wi-Fi range. If your phone says the hotspot has no internet, stay connected.</p>
<div class="footer">Control page hosted by the ESP32 · <span id="ip"></span></div>
</section></main><script>
let token="";let busy=false;const byId=id=>document.getElementById(id);
async function refresh(){try{const r=await fetch('/status',{cache:'no-store'});if(!r.ok)throw new Error('Status unavailable');const s=await r.json();token=s.token;
byId('state').textContent=s.state;byId('detail').textContent='Pixhawk: '+s.pixhawk+' · '+(s.armed?'armed':'disarmed')+' · '+(s.autoRun?'sequence active or queued':'sequence stopped');
byId('ip').textContent=s.ip;byId('repeat-note').textContent=s.repeatEnabled?'After each successful disarm, the sequence repeats in '+s.repeatSeconds+' seconds until you press Stop.':'Start runs the sequence once, then disarms.';
byId('start').disabled=busy||s.autoRun||s.state!=='idle'||s.armed;byId('stop').disabled=busy||(!s.autoRun&&s.state==='idle'&&!s.armed);
}catch(e){byId('state').textContent='ESP32 status unavailable';byId('detail').textContent='Stay connected to the ESP32 hotspot and retry.';byId('start').disabled=true;byId('stop').disabled=true;}}
async function command(path){if(!token||busy)return;busy=true;byId('start').disabled=true;byId('stop').disabled=true;byId('message').textContent='Sending…';try{const r=await fetch('/'+path,{method:'POST',headers:{'X-Control-Token':token}});const d=await r.json();byId('message').textContent=d.message|| (r.ok?'Command accepted':'Command rejected');}catch(e){byId('message').textContent='No reply from ESP32. Refresh status before trying again.';}finally{busy=false;await refresh();}}
byId('start').onclick=()=>command('start');byId('stop').onclick=()=>command('stop');refresh();setInterval(refresh,1000);
</script></body></html>)HTML";

class AuvPilot {
 public:
  void begin() {
    Serial.begin(kConsoleBaud);
    pixhawk_.begin(kPixhawkBaud, SERIAL_8N1, kPixhawkRx, kPixhawkTx);
    autoRunEnabled_ = kAutoStart;
    startupDelayPending_ = kAutoStart && kPixhawkStartupDelayMs != 0;
    startControlPortal();
    Serial.println(kAutoStart
      ? "AuvMavlink ready. Auto-run at boot is enabled. Commands: status, auto, start, stop"
      : "AuvMavlink ready. Waiting for Start on the ESP32 hotspot. Commands: status, auto, prepare, start, up, up10, stop");
  }

  void update() {
    readPixhawk();
    readConsole();
    const uint32_t now = millis();
    updateSequence(now);

    if (now - lastHeartbeatSent_ >= kHeartbeatInterval) {
      mavlink_message_t message;
      mavlink_msg_heartbeat_pack(kPilotSystem, kPilotComponent, &message,
                                 MAV_TYPE_GCS, MAV_AUTOPILOT_INVALID, 0, 0, MAV_STATE_ACTIVE);
      send(message);
      lastHeartbeatSent_ = now;
    }

    if (now - lastPilotSent_ >= kPilotInterval) {
      if (state_ == State::Running) {
        const Leg &leg = legs_[legIndex_];
        sendPilot(leg.surge, leg.heave, leg.sway, leg.fullTurn ? turnPilotInput(leg) : leg.yaw);
      } else if (state_ == State::SettingMode || state_ == State::Arming) {
        sendPilot(0, kNeutralHeave);
      }
      lastPilotSent_ = now;
    }
    controlWebServer.handleClient();
  }

 private:
  enum class State {
    Idle, CheckingFailsafe, CheckingHome, SettingMode, CheckingAttitude,
    Arming, Running, NeutralAfterTurn, Disarming
  };

  HardwareSerial pixhawk_{2};
  State state_ = State::Idle;
  uint32_t stateSince_ = 0;
  uint32_t lastRequestSent_ = 0;
  uint32_t lastHeartbeatSent_ = 0;
  uint32_t lastPilotSent_ = 0;
  uint8_t vehicleSystem_ = 0;
  uint32_t vehicleMode_ = 0;
  uint32_t requestedMode_ = kMissionMode;
  uint32_t nextAutoStartAt_ = 0;
  uint32_t startupDelaySince_ = 0;
  bool vehicleArmed_ = false;
  uint32_t lastVehicleHeartbeat_ = 0;
  uint32_t heartbeatCount_ = 0;
  uint32_t commandHeartbeatCount_ = 0;
  bool armAccepted_ = false;
  uint8_t disarmedReports_ = 0;
  bool havePilotAction_ = false;
  bool havePilotTimeout_ = false;
  float pilotAction_ = 0;
  float pilotTimeout_ = 0;
  bool runAfterPreparation_ = false;
  bool autoRunEnabled_ = false;
  bool currentSequenceAuto_ = false;
  bool repeatAfterDisarm_ = false;
  bool startupDelayPending_ = false;
  bool startupDelayStarted_ = false;
  char controlToken_[17]{};
  bool haveHome_ = false;
  bool haveOrigin_ = false;
  bool homeRequested_ = false;
  mavlink_gps_global_origin_t origin_{};
  const Leg *legs_ = kLegs;
  size_t legCount_ = kLegCount;
  size_t legIndex_ = 0;
  uint32_t runStarted_ = 0;
  uint32_t legEndsAt_ = 0;
  bool needsYaw_ = false;
  uint8_t yawSamples_ = 0;
  uint32_t lastYawAt_ = 0;
  uint32_t lastYawBootTime_ = 0;
  float lastYaw_ = 0;
  float turnAngle_ = 0;
  char consoleLine_[24]{};
  size_t consoleLength_ = 0;
  bool consoleOverflow_ = false;

  bool linkFresh(uint32_t now) const {
    return vehicleSystem_ != 0 && now - lastVehicleHeartbeat_ <= kHeartbeatTimeout;
  }

  bool attitudeFresh(uint32_t now) const {
    return yawSamples_ >= 2 && now - lastYawAt_ <= kAttitudeTimeout;
  }

  void startControlPortal() {
    snprintf(controlToken_, sizeof(controlToken_), "%08lx%08lx",
             static_cast<unsigned long>(esp_random()), static_cast<unsigned long>(esp_random()));
    WiFi.mode(WIFI_AP);
    if (!WiFi.softAP(kApSsid, kApPassword)) {
      Serial.println("Could not start the control hotspot.");
      return;
    }
    static const char *headers[] = {"X-Control-Token"};
    controlWebServer.collectHeaders(headers, 1);
    controlWebServer.on("/", HTTP_GET, [this]() {
      controlWebServer.send_P(200, "text/html; charset=utf-8", kControlPage);
    });
    controlWebServer.on("/status", HTTP_GET, [this]() { sendWebStatus(); });
    controlWebServer.on("/start", HTTP_POST, [this]() { handleWebStart(); });
    controlWebServer.on("/stop", HTTP_POST, [this]() { handleWebStop(); });
    controlWebServer.onNotFound([this]() {
      controlWebServer.send(404, "application/json", "{\"message\":\"Unknown control route\"}");
    });
    controlWebServer.begin();
    Serial.printf("Hotspot name: %s\nHotspot password: %s\nControl page: http://%s/\n",
                  kApSsid, kApPassword, WiFi.softAPIP().toString().c_str());
  }

  bool validControlToken() {
    return controlWebServer.header("X-Control-Token").equals(controlToken_);
  }

  void sendWebStatus() {
    char body[320];
    const uint32_t now = millis();
    const String ip = WiFi.softAPIP().toString();
    snprintf(body, sizeof(body),
             "{\"state\":\"%s\",\"pixhawk\":\"%s\",\"armed\":%s,\"autoRun\":%s,\"repeatEnabled\":%s,\"token\":\"%s\",\"ip\":\"%s\",\"repeatSeconds\":%lu}",
             stateName(), linkFresh(now) ? "live" : "waiting", vehicleArmed_ ? "true" : "false",
             autoRunEnabled_ ? "true" : "false", kRepeatEnabled ? "true" : "false", controlToken_, ip.c_str(),
             static_cast<unsigned long>(kRepeatIntervalMs / 1000));
    controlWebServer.send(200, "application/json", body);
  }

  void handleWebStart() {
    const uint32_t now = millis();
    if (!validControlToken()) {
      controlWebServer.send(403, "application/json", "{\"message\":\"Refresh the control page and try again\"}");
    } else if (state_ != State::Idle || autoRunEnabled_) {
      controlWebServer.send(409, "application/json", "{\"message\":\"A sequence is already active or waiting\"}");
    } else if (linkFresh(now) && vehicleArmed_) {
      controlWebServer.send(409, "application/json", "{\"message\":\"Pixhawk is armed. Stop and disarm it before starting\"}");
    } else {
      autoRunEnabled_ = true;
      currentSequenceAuto_ = false;
      repeatAfterDisarm_ = false;
      nextAutoStartAt_ = now;
      startupDelayPending_ = kPixhawkStartupDelayMs != 0;
      startupDelayStarted_ = false;
      Serial.println("Web Start accepted. Waiting for a fresh, disarmed Pixhawk and startup delay.");
      controlWebServer.send(202, "application/json", "{\"message\":\"Start accepted. Waiting for Pixhawk startup\"}");
    }
  }

  void handleWebStop() {
    if (!validControlToken()) {
      controlWebServer.send(403, "application/json", "{\"message\":\"Refresh the control page and try again\"}");
      return;
    }
    autoRunEnabled_ = false;
    repeatAfterDisarm_ = false;
    startupDelayPending_ = false;
    startupDelayStarted_ = false;
    if ((state_ != State::Idle || vehicleArmed_) && state_ != State::Disarming && vehicleSystem_ != 0) {
      startDisarming(millis());
    }
    Serial.println("Web Stop accepted. Auto-repeat disabled.");
    controlWebServer.send(200, "application/json", "{\"message\":\"Stop accepted. Disarming if the Pixhawk is armed\"}");
  }

  void enter(State state, uint32_t now) {
    state_ = state;
    stateSince_ = now;
  }

  const char *modeName(uint32_t mode) const {
    switch (mode) {
      case kStabilizeMode: return "STABILIZE";
      case 1: return "ACRO";
      case 19: return "MANUAL";
      default: return "other";
    }
  }

  const char *stateName() const {
    switch (state_) {
      case State::Idle:
        return autoRunEnabled_ ? (startupDelayPending_ ? "waiting for Pixhawk startup" : "auto-run waiting") : "idle";
      case State::CheckingFailsafe: return "checking pilot failsafe";
      case State::CheckingHome: return "checking home";
      case State::SettingMode: return "setting flight mode";
      case State::CheckingAttitude: return "checking yaw telemetry";
      case State::Arming: return "arming";
      case State::Running: return legs_[legIndex_].name;
      case State::NeutralAfterTurn: return "neutral after full turn";
      case State::Disarming: return "disarming";
    }
    return "unknown";
  }

  void send(const mavlink_message_t &message) {
    uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
    const uint16_t length = mavlink_msg_to_send_buffer(buffer, &message);
    pixhawk_.write(buffer, length);
  }

  void sendCommand(uint16_t command, float param1, float param2 = 0) {
    mavlink_message_t message;
    mavlink_msg_command_long_pack(kPilotSystem, kPilotComponent, &message,
                                    vehicleSystem_, MAV_COMP_ID_AUTOPILOT1, command, 0,
                                    param1, param2, 0, 0, 0, 0, 0);
    send(message);
  }

  void sendPilot(int16_t surge, int16_t heave, int16_t sway = 0, int16_t yaw = 0) {
    mavlink_manual_control_t control{};
    control.target = vehicleSystem_;
    control.x = surge;
    control.y = sway;
    control.z = heave;
    control.r = yaw;
    mavlink_message_t message;
    mavlink_msg_manual_control_encode(kPilotSystem, kPilotComponent, &message, &control);
    send(message);
  }

  void requestParameter(const char *name) {
    mavlink_message_t message;
    mavlink_msg_param_request_read_pack(kPilotSystem, kPilotComponent, &message,
                                         vehicleSystem_, MAV_COMP_ID_AUTOPILOT1, name, -1);
    send(message);
  }

  void requestFailsafe(uint32_t now) {
    if (!havePilotAction_) {
      requestParameter(kPilotActionParameter);
    }
    if (!havePilotTimeout_) {
      requestParameter(kPilotTimeoutParameter);
    }
    lastRequestSent_ = now;
  }

  void requestHome(uint32_t now) {
    sendCommand(MAV_CMD_REQUEST_MESSAGE, MAVLINK_MSG_ID_HOME_POSITION);
    if (!haveOrigin_) {
      sendCommand(MAV_CMD_REQUEST_MESSAGE, MAVLINK_MSG_ID_GPS_GLOBAL_ORIGIN);
    }
    lastRequestSent_ = now;
  }

  void requestAttitude(uint32_t now) {
    sendCommand(MAV_CMD_SET_MESSAGE_INTERVAL, MAVLINK_MSG_ID_ATTITUDE, kAttitudeIntervalMicros);
    lastRequestSent_ = now;
  }

  void setHomeFromOrigin() {
    mavlink_command_int_t command{};
    command.target_system = vehicleSystem_;
    command.target_component = MAV_COMP_ID_AUTOPILOT1;
    command.frame = MAV_FRAME_GLOBAL;
    command.command = MAV_CMD_DO_SET_HOME;
    command.param4 = NAN;
    command.x = origin_.latitude;
    command.y = origin_.longitude;
    command.z = origin_.altitude * 0.001f;
    mavlink_message_t message;
    mavlink_msg_command_int_encode(kPilotSystem, kPilotComponent, &message, &command);
    send(message);
    homeRequested_ = true;
    Serial.println("Requested home at the Pixhawk's existing EKF origin.");
  }

  void readPixhawk() {
    mavlink_message_t message;
    mavlink_status_t parserStatus;
    // Bound each pass so continuous input cannot starve the stop command or timers.
    for (size_t count = 0; count < 256 && pixhawk_.available(); ++count) {
      if (mavlink_parse_char(MAVLINK_COMM_0, pixhawk_.read(), &message, &parserStatus)) {
        handleMessage(message);
      }
    }
  }

  void handleMessage(const mavlink_message_t &message) {
    if (message.compid != MAV_COMP_ID_AUTOPILOT1 || message.sysid == 0 ||
        (vehicleSystem_ != 0 && message.sysid != vehicleSystem_)) {
      return;
    }

    if (message.msgid == MAVLINK_MSG_ID_HEARTBEAT) {
      mavlink_heartbeat_t heartbeat;
      mavlink_msg_heartbeat_decode(&message, &heartbeat);
      if (heartbeat.type != MAV_TYPE_SUBMARINE || heartbeat.autopilot != MAV_AUTOPILOT_ARDUPILOTMEGA) {
        return;
      }
      if (vehicleSystem_ == 0) {
        Serial.printf("ArduSub connected, system %u\n", message.sysid);
      }
      vehicleSystem_ = message.sysid;
      lastVehicleHeartbeat_ = millis();
      ++heartbeatCount_;
      vehicleMode_ = heartbeat.custom_mode;
      vehicleArmed_ = (heartbeat.base_mode & MAV_MODE_FLAG_SAFETY_ARMED) != 0;
      if (state_ == State::Disarming) {
        disarmedReports_ = vehicleArmed_ ? 0 : disarmedReports_ + 1;
      }
      return;
    }

    if (vehicleSystem_ == 0) {
      return;
    }

    switch (message.msgid) {
      case MAVLINK_MSG_ID_PARAM_VALUE:
        handleParameter(message);
        break;
      case MAVLINK_MSG_ID_COMMAND_ACK:
        handleAck(message);
        break;
      case MAVLINK_MSG_ID_ATTITUDE:
        handleAttitude(message);
        break;
      case MAVLINK_MSG_ID_HOME_POSITION:
        if (state_ == State::CheckingHome) {
          haveHome_ = true;
        }
        break;
      case MAVLINK_MSG_ID_GPS_GLOBAL_ORIGIN:
        if (state_ == State::CheckingHome) {
          mavlink_msg_gps_global_origin_decode(&message, &origin_);
          haveOrigin_ = true;
        }
        break;
      case MAVLINK_MSG_ID_STATUSTEXT: {
        mavlink_statustext_t status;
        mavlink_msg_statustext_decode(&message, &status);
        Serial.printf("Pixhawk: %.*s\n", static_cast<int>(sizeof(status.text)), status.text);
        break;
      }
    }
  }

  void handleAttitude(const mavlink_message_t &message) {
    if (!needsYaw_ || (state_ != State::CheckingAttitude && state_ != State::Arming &&
        state_ != State::Running && state_ != State::NeutralAfterTurn)) {
      return;
    }
    mavlink_attitude_t attitude;
    mavlink_msg_attitude_decode(&message, &attitude);
    const uint32_t now = millis();
    const float yaw = attitude.yaw;
    if (!isfinite(yaw) || fabsf(yaw) > kPi + 0.001f) {
      rejectAttitude(now);
      return;
    }
    if (yawSamples_ != 0) {
      const uint32_t sampleGap = attitude.time_boot_ms - lastYawBootTime_;
      if (sampleGap == 0) return;
      // Positive yaw is a right turn in the MAVLink Z-down frame.
      float delta = yaw - lastYaw_;
      if (delta > kPi) delta -= kFullTurn;
      if (delta < -kPi) delta += kFullTurn;
      // Reject clock jumps, receive gaps, and implausible changes (up to 360 deg/s plus noise).
      if (sampleGap > kAttitudeTimeout || now - lastYawAt_ > kAttitudeTimeout ||
          fabsf(delta) > kMaxYawSampleDelta || fabsf(delta) > kYawTolerance + kFullTurn * sampleGap * 0.001f) {
        rejectAttitude(now);
        if (state_ != State::CheckingAttitude) return;
      } else if (state_ == State::Running && legs_[legIndex_].fullTurn) {
        turnAngle_ += delta;
      }
    }
    lastYaw_ = yaw;
    lastYawAt_ = now;
    lastYawBootTime_ = attitude.time_boot_ms;
    if (yawSamples_ < 2) ++yawSamples_;
  }

  void rejectAttitude(uint32_t now) {
    yawSamples_ = 0;
    if (state_ != State::CheckingAttitude) {
      Serial.println("Pixhawk yaw telemetry invalid or interrupted. Disarming.");
      startDisarming(now);
    }
  }

  void handleParameter(const mavlink_message_t &message) {
    if (state_ != State::CheckingFailsafe) {
      return;
    }
    mavlink_param_value_t parameter;
    mavlink_msg_param_value_decode(&message, &parameter);
    if (!strncmp(parameter.param_id, kPilotActionParameter, sizeof(parameter.param_id))) {
      pilotAction_ = parameter.param_value;
      havePilotAction_ = true;
    } else if (!strncmp(parameter.param_id, kPilotTimeoutParameter, sizeof(parameter.param_id))) {
      pilotTimeout_ = parameter.param_value;
      havePilotTimeout_ = true;
    }
  }

  void handleAck(const mavlink_message_t &message) {
    mavlink_command_ack_t ack;
    mavlink_msg_command_ack_decode(&message, &ack);
    if ((ack.target_system && ack.target_system != kPilotSystem) ||
        (ack.target_component && ack.target_component != kPilotComponent)) {
      return;
    }
    if (state_ == State::CheckingHome && ack.command == MAV_CMD_DO_SET_HOME &&
        ack.result != MAV_RESULT_ACCEPTED && ack.result != MAV_RESULT_IN_PROGRESS) {
      Serial.printf("Pixhawk rejected home, MAV_RESULT %u\n", ack.result);
      preflightFailed(millis());
    }
    if (state_ == State::SettingMode && ack.command == MAV_CMD_DO_SET_MODE &&
        ack.result != MAV_RESULT_ACCEPTED && ack.result != MAV_RESULT_IN_PROGRESS) {
      Serial.printf("%s rejected, MAV_RESULT %u\n", modeName(requestedMode_), ack.result);
      startDisarming(millis());
    }
    if (state_ == State::Arming && ack.command == MAV_CMD_COMPONENT_ARM_DISARM) {
      if (ack.result == MAV_RESULT_ACCEPTED) {
        armAccepted_ = true;
      } else if (ack.result != MAV_RESULT_IN_PROGRESS) {
        Serial.printf("Normal arming rejected, MAV_RESULT %u\n", ack.result);
        startDisarming(millis());
      }
    }
  }

  void readConsole() {
    for (size_t count = 0; count < 64 && Serial.available(); ++count) {
      const char character = Serial.read();
      if (character == '\n' || character == '\r') {
        if (consoleOverflow_) {
          Serial.println("Command too long. Use status, prepare, start, up, up10 or stop.");
        } else if (consoleLength_ != 0) {
          consoleLine_[consoleLength_] = '\0';
          handleConsole();
        }
        consoleLength_ = 0;
        consoleOverflow_ = false;
      } else if (consoleLength_ < sizeof(consoleLine_) - 1) {
        consoleLine_[consoleLength_++] = character;
      } else {
        consoleOverflow_ = true;
      }
    }
  }

  void handleConsole() {
    const uint32_t now = millis();
    const bool shortUp = !strcmp(consoleLine_, "up");
    const bool longUp = !strcmp(consoleLine_, "up10");
    if (!strcmp(consoleLine_, "status")) {
      Serial.printf("State: %s. Pixhawk link: %s. Auto-run: %s. Startup wait: %lu s; repeat pause: %lu s.\n",
                    stateName(), linkFresh(now) ? "live" : "waiting", autoRunEnabled_ ? "on" : "off",
                    static_cast<unsigned long>(kPixhawkStartupDelayMs / 1000),
                    static_cast<unsigned long>(kRepeatIntervalMs / 1000));
      if (vehicleSystem_ != 0) {
        Serial.printf("Last heartbeat: system %u, mode %lu, %s, age %lu ms\n", vehicleSystem_,
                      static_cast<unsigned long>(vehicleMode_), vehicleArmed_ ? "armed" : "disarmed",
                      static_cast<unsigned long>(now - lastVehicleHeartbeat_));
        Serial.printf("Pixhawk flight mode: %s (%lu)\n", modeName(vehicleMode_),
                      static_cast<unsigned long>(vehicleMode_));
      }
    } else if (!strcmp(consoleLine_, "auto")) {
      autoRunEnabled_ = true;
      nextAutoStartAt_ = now;
      startupDelayPending_ = kPixhawkStartupDelayMs != 0;
      startupDelayStarted_ = false;
      Serial.printf("Auto-run enabled. Waiting %lu seconds after the Pixhawk link is live.\n",
                    static_cast<unsigned long>(kPixhawkStartupDelayMs / 1000));
    } else if (!strcmp(consoleLine_, "start") || !strcmp(consoleLine_, "prepare") ||
               shortUp || longUp) {
      if (state_ != State::Idle || !linkFresh(now) || vehicleArmed_) {
        Serial.println("Preparation requires idle state and a fresh, disarmed ArduSub heartbeat.");
        return;
      }
      // Explicit serial requests are one-shot actions. Send the auto command to resume repetition.
      autoRunEnabled_ = false;
      Serial.println("Manual request accepted. Auto-run is disabled for this session.");
      runAfterPreparation_ = strcmp(consoleLine_, "prepare") != 0;
      currentSequenceAuto_ = false;
      repeatAfterDisarm_ = false;
      requestedMode_ = shortUp || longUp ? kStabilizeMode : kMissionMode;
      needsYaw_ = kMissionHasFullTurn && !shortUp && !longUp;
      legs_ = kLegs;
      legCount_ = kLegCount;
      if (shortUp || longUp) {
        legs_ = longUp ? &kUp10Leg : &kUpLeg;
        legCount_ = 1;
      }
      havePilotAction_ = false;
      havePilotTimeout_ = false;
      enter(State::CheckingFailsafe, now);
      requestFailsafe(now);
      Serial.println("Checking Pixhawk pilot failsafe settings.");
    } else if (!strcmp(consoleLine_, "stop")) {
      autoRunEnabled_ = false;
      repeatAfterDisarm_ = false;
      if (state_ == State::Idle) {
        Serial.println("Auto-run disabled. Mission remains idle.");
      } else if (vehicleSystem_ == 0) {
        Serial.println("Auto-run disabled, but no Pixhawk is detected. Use the independent propulsion stop if needed.");
      } else if (state_ != State::Disarming) {
        Serial.println("Stop requested. Disarming and disabling repeat.");
        startDisarming(now);
      }
    } else {
      Serial.println("Commands: status, auto, prepare, start, up, up10, stop");
    }
  }

  void startDisarming(uint32_t now, bool sequenceCompleted = false) {
    repeatAfterDisarm_ = sequenceCompleted && autoRunEnabled_ && kRepeatEnabled;
    if (sequenceCompleted && !kRepeatEnabled) {
      autoRunEnabled_ = false;
      Serial.println("Sequence finished. Repeat is disabled; awaiting a new Start.");
    }
    if (!sequenceCompleted && currentSequenceAuto_ && autoRunEnabled_) {
      autoRunEnabled_ = false;
      Serial.println("Auto-run stopped after an interrupted or failed sequence.");
    }
    currentSequenceAuto_ = false;
    enter(State::Disarming, now);
    disarmedReports_ = 0;
    sendPilot(0, kNeutralHeave);
    sendCommand(MAV_CMD_COMPONENT_ARM_DISARM, 0);
    // Stop streaming pilot frames so a failed disarm can still trip the pilot failsafe.
    lastRequestSent_ = now;
  }

  void startArming(uint32_t now) {
    enter(State::Arming, now);
    commandHeartbeatCount_ = heartbeatCount_;
    armAccepted_ = false;
    sendPilot(0, kNeutralHeave);
    sendCommand(MAV_CMD_COMPONENT_ARM_DISARM, 1);
    Serial.println("Requesting normal arming.");
  }

  void preflightFailed(uint32_t now) {
    if (currentSequenceAuto_ && autoRunEnabled_) {
      autoRunEnabled_ = false;
      Serial.println("Auto-run stopped after a preflight failure. Correct the issue, then send auto or reboot.");
    }
    currentSequenceAuto_ = false;
    repeatAfterDisarm_ = false;
    enter(State::Idle, now);
  }

  void startLeg(uint32_t now) {
    const Leg &leg = legs_[legIndex_];
    if (leg.fullTurn) {
      // The latest accepted yaw is the baseline. Samples from earlier legs add no progress.
      turnAngle_ = 0;
      runStarted_ = now;
      legEndsAt_ = 0;
    }
    legEndsAt_ += leg.durationMs;
    if (now - runStarted_ >= legEndsAt_) {
      Serial.println("Missed a complete movement window. Disarming.");
      startDisarming(now);
      return;
    }
    Serial.printf("Running: %s\n", leg.name);
    lastPilotSent_ = now - kPilotInterval;
  }

  void advanceLeg(uint32_t now) {
    const bool completedTurn = legs_[legIndex_].fullTurn;
    if (++legIndex_ == legCount_) {
      Serial.println("Sequence finished. Disarming.");
      startDisarming(now, true);
    } else if (completedTurn) {
      // Give Pixhawk a neutral pilot interval before the next input and timing window.
      sendPilot(0, kNeutralHeave);
      lastPilotSent_ = now;
      enter(State::NeutralAfterTurn, now);
    } else {
      startLeg(now);
    }
  }

  float turnError(const Leg &leg) const {
    const float target = leg.yaw > 0 ? kFullTurn : -kFullTurn;
    return target - turnAngle_;
  }

  int16_t turnPilotInput(const Leg &leg) const {
    const float error = turnError(leg);
    const int16_t maxInput = abs(leg.yaw);
    const int16_t minInput = maxInput < kYawTaperFloor ? maxInput : kYawTaperFloor;
    const float fraction = fabsf(error) / kYawSlowdown;
    const int16_t tapered = fraction >= 1.0f ? maxInput : roundf(maxInput * fraction);
    const int16_t input = tapered < minInput ? minInput : tapered;
    return error > 0 ? input : -input;
  }

  void updateSequence(uint32_t now) {
    if (state_ == State::Idle) {
      if (autoRunEnabled_ && linkFresh(now) && vehicleArmed_) {
        autoRunEnabled_ = false;
        Serial.println("Auto-start canceled because the Pixhawk was already armed. Disarm it, then send auto to resume.");
      } else if (autoRunEnabled_ && linkFresh(now)) {
        if (startupDelayPending_) {
          if (!startupDelayStarted_) {
            startupDelaySince_ = now;
            startupDelayStarted_ = true;
            Serial.printf("Pixhawk heartbeat is live and disarmed. Waiting %lu seconds for startup.\n",
                          static_cast<unsigned long>(kPixhawkStartupDelayMs / 1000));
          } else if (now - startupDelaySince_ >= kPixhawkStartupDelayMs) {
            startupDelayPending_ = false;
            startupDelayStarted_ = false;
            Serial.println("Pixhawk startup wait complete.");
          }
        }
        if (!startupDelayPending_ && static_cast<int32_t>(now - nextAutoStartAt_) >= 0) {
          startAutomaticSequence(now);
        }
      } else if (autoRunEnabled_ && startupDelayPending_ && startupDelayStarted_) {
        startupDelayStarted_ = false;
        Serial.println("Pixhawk link dropped during startup wait. The timer will restart when the link returns.");
      }
      return;
    }
    if (state_ == State::Disarming) {
      if (disarmedReports_ >= 2) {
        enter(State::Idle, now);
        if (repeatAfterDisarm_ && autoRunEnabled_) {
          nextAutoStartAt_ = now + kRepeatIntervalMs;
          repeatAfterDisarm_ = false;
          Serial.printf("Disarmed. Next sequence starts in %lu seconds.\n",
                        static_cast<unsigned long>(kRepeatIntervalMs / 1000));
        } else {
          repeatAfterDisarm_ = false;
          Serial.println("Disarmed. Awaiting a new start.");
        }
      } else if (now - lastRequestSent_ >= kRetryInterval) {
        sendCommand(MAV_CMD_COMPONENT_ARM_DISARM, 0);
        lastRequestSent_ = now;
      }
      return;
    }
    if (!linkFresh(now)) {
      Serial.println("Pixhawk heartbeat lost. Disarming.");
      startDisarming(now);
      return;
    }
    const bool executing = state_ == State::Running || state_ == State::NeutralAfterTurn;
    if (needsYaw_ && (state_ == State::Arming || executing) && !attitudeFresh(now)) {
      Serial.println("Pixhawk yaw telemetry lost. Disarming.");
      startDisarming(now);
      return;
    }
    if (executing) {
      if (!vehicleArmed_ || vehicleMode_ != requestedMode_) {
        Serial.println("Vehicle armed state or mode changed. Disarming.");
        startDisarming(now);
        return;
      }
      if (now - lastPilotSent_ > kMaxPilotGap || now - lastPilotSent_ >= pilotTimeout_ * 1000.0f) {
        Serial.println("Pilot stream deadline missed. Disarming.");
        startDisarming(now);
        return;
      }
    }

    switch (state_) {
      case State::CheckingFailsafe:
        if (vehicleArmed_) {
          Serial.println("Pixhawk armed outside this sequence. Disarming.");
          startDisarming(now);
        } else if (havePilotAction_ && havePilotTimeout_) {
          if (pilotAction_ != 2 || !(pilotTimeout_ >= 0.1f && pilotTimeout_ <= 3.0f)) {
            Serial.println("Start blocked. Set FS_PILOT_INPUT=2 and FS_PILOT_TIMEOUT to 0.1-3.0 s.");
            preflightFailed(now);
            return;
          }
          Serial.printf("Pilot failsafe is set to disarm after %.2f s. Checking home.\n", pilotTimeout_);
          haveHome_ = false;
          haveOrigin_ = false;
          homeRequested_ = false;
          enter(State::CheckingHome, now);
          requestHome(now);
        } else if (now - stateSince_ >= kCommandTimeout) {
          Serial.println("Start blocked. Pixhawk did not return the pilot failsafe settings.");
          preflightFailed(now);
        } else if (now - lastRequestSent_ >= kRetryInterval) {
          requestFailsafe(now);
        }
        break;

      case State::CheckingHome:
        if (vehicleArmed_) {
          Serial.println("Pixhawk armed outside this sequence. Disarming.");
          startDisarming(now);
        } else if (haveHome_) {
          enter(State::SettingMode, now);
          commandHeartbeatCount_ = heartbeatCount_;
          sendCommand(MAV_CMD_DO_SET_MODE, MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, requestedMode_);
          Serial.printf("Home confirmed. Requesting %s.\n", modeName(requestedMode_));
        } else if (now - stateSince_ >= kCommandTimeout) {
          Serial.println("Home unconfirmed. Check the Pixhawk's GPS-free EKF origin.");
          preflightFailed(now);
        } else if (haveOrigin_ && !homeRequested_ && now - stateSince_ >= kOriginWait) {
          setHomeFromOrigin();
        } else if (now - lastRequestSent_ >= kRetryInterval) {
          requestHome(now);
        }
        break;

      case State::SettingMode:
        if (vehicleArmed_ || now - stateSince_ >= kCommandTimeout) {
          Serial.printf("Could not confirm disarmed %s. Disarming.\n", modeName(requestedMode_));
          startDisarming(now);
        } else if (heartbeatCount_ != commandHeartbeatCount_ && vehicleMode_ == requestedMode_) {
          if (needsYaw_) {
            yawSamples_ = 0;
            enter(State::CheckingAttitude, now);
            requestAttitude(now);
            Serial.println("Waiting for Pixhawk yaw telemetry.");
          } else if (runAfterPreparation_) {
            startArming(now);
          } else {
            enter(State::Idle, now);
            Serial.printf("%s confirmed. Pixhawk remains disarmed.\n", modeName(vehicleMode_));
          }
        }
        break;

      case State::CheckingAttitude:
        if (vehicleArmed_ || vehicleMode_ != requestedMode_) {
          Serial.println("Vehicle armed state or mode changed while checking yaw. Disarming.");
          startDisarming(now);
        } else if (now - stateSince_ >= kCommandTimeout) {
          Serial.println("Preparation blocked. Pixhawk did not provide live yaw telemetry.");
          preflightFailed(now);
        } else if (attitudeFresh(now)) {
          Serial.printf("Live Pixhawk yaw confirmed: %.1f degrees.\n", lastYaw_ * (180.0f / kPi));
          if (runAfterPreparation_) {
            startArming(now);
          } else {
            enter(State::Idle, now);
            Serial.printf("%s confirmed. Pixhawk remains disarmed.\n", modeName(vehicleMode_));
          }
        } else if (now - lastRequestSent_ >= kRetryInterval) {
          requestAttitude(now);
        }
        break;

      case State::Arming:
        if (vehicleMode_ != requestedMode_ || now - stateSince_ >= kCommandTimeout) {
          Serial.printf("Could not confirm normal arming in %s. Disarming.\n", modeName(requestedMode_));
          startDisarming(now);
        } else if (armAccepted_ && vehicleArmed_ && heartbeatCount_ != commandHeartbeatCount_) {
          enter(State::Running, now);
          runStarted_ = now;
          legIndex_ = 0;
          legEndsAt_ = 0;
          startLeg(now);
        }
        break;

      case State::Running: {
        const Leg &leg = legs_[legIndex_];
        const bool expired = now - runStarted_ >= legEndsAt_;
        if (leg.fullTurn) {
          if (expired) {
            Serial.printf("%s timed out. Disarming.\n", leg.name);
            startDisarming(now);
          } else if (fabsf(turnError(leg)) <= kYawTolerance) {
            Serial.printf("%s reached its target.\n", leg.name);
            advanceLeg(now);
          }
        } else if (expired) {
          advanceLeg(now);
        }
        break;
      }

      case State::NeutralAfterTurn:
        if (now - stateSince_ >= kPilotInterval) {
          enter(State::Running, now);
          runStarted_ = now;
          legEndsAt_ = 0;
          startLeg(now);
        }
        break;

      case State::Idle:
      case State::Disarming:
        break;
    }
  }

  void startAutomaticSequence(uint32_t now) {
    currentSequenceAuto_ = true;
    repeatAfterDisarm_ = false;
    runAfterPreparation_ = true;
    requestedMode_ = kMissionMode;
    needsYaw_ = kMissionHasFullTurn;
    legs_ = kLegs;
    legCount_ = kLegCount;
    havePilotAction_ = false;
    havePilotTimeout_ = false;
    enter(State::CheckingFailsafe, now);
    requestFailsafe(now);
    Serial.println("Sequence start: checking Pixhawk failsafe settings.");
  }
};

AuvPilot pilot;
}

void setup() {
  pilot.begin();
}

void loop() {
  pilot.update();
  delay(1);
}
`;

  const api = Object.freeze({moves, modes, nominalYawRateDegPerSecond, defaults, validate, validateOptions, trajectory, generate});
  if (typeof window !== "undefined") window.DiveMission = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
