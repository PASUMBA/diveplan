(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const icons = {
    sliders:'<path d="M4 6h8m4 0h4M4 12h2m4 0h10M4 18h10m4 0h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
    code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
    upload:'<path d="M12 15V3m-4 4 4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    pencil:'<path d="m4 16-1 5 5-1L20 8l-4-4zM14 6l4 4"/>',
    frame:'<path d="m6 8 6-3 6 3v8l-6 3-6-3zm0 0 6 4 6-4m-6 4v7"/><path d="m2 6 3-2m14 0 3 2M2 18l3 2m14 0 3-2"/>',
    level:'<path d="M2 12h6l4 3 4-3h6M12 4v5m-4 9h8"/>',
    chevronDown:'<path d="m6 9 6 6 6-6"/>',chevronRight:'<path d="m9 5 7 7-7 7"/>',
    list:'<rect x="3" y="4" width="4" height="4" rx=".6"/><rect x="3" y="10" width="4" height="4" rx=".6"/><rect x="3" y="16" width="4" height="4" rx=".6"/><path d="M10 6h10M10 12h10M10 18h10"/>',
    cube:'<path d="m12 2 9 5v10l-9 5-9-5V7zm-9 5 9 5 9-5m-9 5v10"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
    collapse:'<path d="M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>',
    orbit:'<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-26 12 12)"/><circle cx="12" cy="12" r="2"/>',
    focus:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/><circle cx="12" cy="12" r="2"/>',
    play:'<path fill="currentColor" stroke="none" d="M6 3.7a.8.8 0 0 1 1.2-.7l13 8.3a.9.9 0 0 1 0 1.4L7.2 21a.8.8 0 0 1-1.2-.7z"/>',
    pause:'<path d="M8 5v14m8-14v14" stroke-width="3.5"/>',
    rewind:'<path d="M5 5v14m14-14L8 12l11 7z"/>',
    timeline:'<path d="M3 20V4m0 13h7m-7-5h13M3 7h18"/><path d="M11 15v4m6-9v4m4-9v4"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.2"/>',
    checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    forward:'<path d="m5 18 13-13M8 5h10v10"/>',backward:'<path d="M19 5 6 18m10 0H6V8"/>',
    up:'<path d="M12 20V4m-6 6 6-6 6 6"/>',down:'<path d="M12 4v16m-6-6 6 6 6-6"/>',
    left:'<path d="M21 12H3m6-6-6 6 6 6"/>',right:'<path d="M3 12h18m-6-6 6 6-6 6"/>',
    yawRight:'<path d="M19 13a7.5 7.5 0 1 0-3 5.5m-1-9 4 4 4-4"/>',
    yawLeft:'<path d="M5 13a7.5 7.5 0 1 1 3 5.5m1-9-4 4-4-4"/>',
    hold:'<path d="M8 5v14m8-14v14" stroke-width="2.6"/>',
    dots:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    trash:'<path d="M3 6h18m-16 0 1 15h12l1-15M9 6V3h6v3m-5 4v7m4-7v7"/>',
    route:'<circle cx="5" cy="17" r="2"/><circle cx="19" cy="6" r="2"/><path d="M5 15v-4h14V8"/>',
    refresh:'<path d="M19 8a8 8 0 1 0 0 8m.5-12v5h-5"/>'
  };
  icons.spinRight = icons.yawRight;
  icons.spinLeft = icons.yawLeft;
  function icon(name) {
    return '<i data-icon="' + name + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg></i>';
  }
  document.querySelectorAll("i[data-icon]").forEach(el => { el.outerHTML = icon(el.dataset.icon); });

  const mission = window.DiveMission;
  const scene = window.DiveScene.create($("scene"), view => { $("view-choice").value = view; });
  const storageKey = "diveplan.workspace.v1";
  function newHotspotPassword() {
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(8); window.crypto.getRandomValues(bytes);
      return "Dive-" + Array.from(bytes,value => value.toString(16).padStart(2,"0")).join("");
    }
    return "Dive-" + Date.now().toString(36) + Math.random().toString(36).slice(2,10);
  }
  const modeNotes = {
    STABILIZE: "Self-leveling with manual depth control.",
    MANUAL: "Direct pilot control without attitude stabilization.",
    ACRO: "Body-rate control with manual depth control."
  };
  let name = "Tank maneuver", mode = "STABILIZE", steps = mission.defaults();
  let runOptions = {startControl:"web", repeatEnabled:true, repeatIntervalSeconds:20, startupDelaySeconds:10,
    apSsid:"DivePlan-AUV", apPassword:newHotspotPassword()};
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored && Array.isArray(stored.steps) && Object.hasOwn(modeNotes, stored.mode) &&
        (!stored.steps.length || !mission.validate(stored.steps, stored.mode))) {
      steps = stored.steps;
      mode = stored.mode;
      if (stored.startControl === "web" || stored.startControl === "boot") runOptions.startControl = stored.startControl;
      if (typeof stored.repeatEnabled === "boolean") runOptions.repeatEnabled = stored.repeatEnabled;
      if (Number.isInteger(stored.repeatIntervalSeconds) && stored.repeatIntervalSeconds >= 1 && stored.repeatIntervalSeconds <= 3600) {
        runOptions.repeatIntervalSeconds = stored.repeatIntervalSeconds;
      }
      if (Number.isInteger(stored.startupDelaySeconds) && stored.startupDelaySeconds >= 0 && stored.startupDelaySeconds <= 120) {
        runOptions.startupDelaySeconds = stored.startupDelaySeconds;
      }
      if (typeof stored.apSsid === "string" && /^[A-Za-z0-9_-]{1,31}$/.test(stored.apSsid)) runOptions.apSsid=stored.apSsid;
      if (typeof stored.apPassword === "string" && /^[A-Za-z0-9_-]{8,63}$/.test(stored.apPassword)) runOptions.apPassword=stored.apPassword;
      if (typeof stored.name === "string" && stored.name.trim()) name = stored.name.trim().slice(0,56);
    }
  } catch { /* The editor also runs with browser storage unavailable. */ }
  let path = mission.trajectory(steps), elapsed = 0, playing = false, animation = 0, lastFrame = 0;
  let activeIndex = -1, editingIndex = -1, editingMove = "forward", menuIndex = -1;
  let connection = null, building = false, checkingPorts = false, toastTimer;
  let stepRows = [], cursor = null, hasTimedTurns = false, hasFullTurns = false, useDefaultDuration = false;
  const label = move => move === "hold" ? "Hold neutral" : mission.moves[move].label;
  const turnDirection = move => mission.moves[move].yaw > 0 ? "clockwise" : "counterclockwise";
  const isFullTurn = move => Boolean(mission.moves[move].fullTurn);
  const seconds = value => value.toFixed(1) + " s";
  const totalTime = () => seconds(path.duration) + (hasFullTurns ? " preview" : "");
  function clock(value, tenths) {
    const ticks = Math.max(0,Math.floor(value * 10 + 1e-6));
    const total = Math.floor(ticks / 10);
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2,"0") + (tenths ? "." + ticks % 10 : "");
  }
  function toast(message) {
    clearTimeout(toastTimer); $("toast").textContent = message; $("toast").hidden = false;
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2500);
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({name,mode,steps,...runOptions})); }
    catch { $("saved").textContent = "Browser storage unavailable"; }
  }
  function updateMode() {
    $("mode-select").value = mode;
    $("mode-select").title = modeNotes[mode];
    $("mode-note").textContent = modeNotes[mode];
    $("motion-note").textContent = mode === "STABILIZE"
      ? "Preview shows relative motion. Actual travel depends on buoyancy, thrust and water conditions."
      : modeNotes[mode] + " The preview assumes the vehicle stays level. Travel is shown in relative units.";
    if (hasTimedTurns || hasFullTurns) $("motion-note").textContent += " Preview heading is relative to the start and assumes " +
      mission.nominalYawRateDegPerSecond + "°/s at full yaw input.";
    if (hasTimedTurns) $("motion-note").textContent += " Actual angles for timed rotations will vary.";
    if (hasFullTurns) $("motion-note").textContent += " Full-turn times are estimates.";
  }
  function updateTransport() {
    $("play").innerHTML = icon(playing ? "pause" : "play") + "<span>" + (playing ? "Pause" : "Play") + "</span>";
    $("play").disabled = !steps.length;
    $("rewind").disabled = !steps.length || (elapsed === 0 && !playing);
    $("scrubber").disabled = !steps.length;
  }
  function drawTime() {
    $("scrubber").value = elapsed;
    const progress = path.duration ? elapsed / path.duration * 100 : 0;
    $("scrubber").style.setProperty("--progress", progress + "%");
    const fractionalTime = path.points.some(point => !Number.isInteger(point.t));
    $("clock").textContent = clock(elapsed,fractionalTime) + " / " + clock(path.duration,fractionalTime);
    const heading = scene.render(path,elapsed);
    let timeDescription = seconds(elapsed) + " of " + seconds(path.duration);
    if (hasTimedTurns || hasFullTurns) {
      const degrees = ((Math.round(heading * 180 / Math.PI) % 360) + 360) % 360;
      const headingText = "Relative heading " + degrees + "°";
      $("heading-readout").textContent = headingText;
      timeDescription += ", " + headingText;
    }
    $("scrubber").setAttribute("aria-valuetext", timeDescription);
    if (cursor) { cursor.style.left = "calc(" + progress + "% - " + (progress >= 100 ? 2 : 0) + "px)"; cursor.hidden = elapsed === 0; }
    let index = steps.length ? path.points.findIndex((point,i) => i > 0 && point.t > elapsed) - 1 : -1;
    if (index < 0 && steps.length) index = steps.length - 1;
    if (activeIndex !== index) {
      stepRows[activeIndex]?.classList.remove("active");
      stepRows[index]?.classList.add("active");
      activeIndex = index;
    }
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(animation);
    updateTransport();
  }
  function seek(time) {
    elapsed = Math.max(0,Math.min(path.duration, time)); lastFrame = performance.now();
    drawTime(); updateTransport();
  }
  function playFrame(now) {
    if (!playing) return;
    elapsed = Math.min(path.duration, elapsed + Math.max(0,now-lastFrame)/1000*Number($("speed").value));
    lastFrame = now;
    drawTime();
    if (elapsed >= path.duration) pause(); else animation = requestAnimationFrame(playFrame);
  }
  $("play").onclick = () => {
    if (playing) { pause(); return; }
    if (!path.duration) return;
    if (elapsed >= path.duration) seek(0);
    playing = true; lastFrame = performance.now(); updateTransport();
    animation = requestAnimationFrame(playFrame);
  };
  $("rewind").onclick = () => {pause();seek(0);};
  $("scrubber").oninput = event => seek(Number(event.target.value));
  $("view-choice").onchange = event => scene.setView(event.target.value);
  function resetCamera(){scene.reset();}
  $("reset-view").onclick = resetCamera;
  function togglePreview(expand) {
    $("preview-panel").classList.toggle("expanded",expand);
    $("expand").innerHTML = icon(expand ? "collapse" : "expand");
    $("expand").title = expand ? "Collapse preview" : "Expand preview";
    $("expand").setAttribute("aria-label",$("expand").title);
    $("expand").setAttribute("aria-expanded",String(expand));
  }
  $("expand").onclick = () => togglePreview(!$("preview-panel").classList.contains("expanded"));
  document.addEventListener("visibilitychange",() => { if (document.hidden && playing) pause(); });

  function renderTimeline() {
    const line = $("timeline");
    line.replaceChildren(); $("ticks").replaceChildren(); cursor = null;
    // Keep small segments proportional. Scrolling gives extended missions a little more room.
    line.parentElement.style.minWidth = steps.length > 8 ? steps.length * 45 + "px" : "100%";
    if (!steps.length) {line.innerHTML = '<span class="timeline-empty">Add a movement to start the timeline.</span>';return;}
    steps.forEach((step,i) => {
      const segment = document.createElement("button");
      segment.className = "timeline-segment " + step.move;
      const start = path.points[i].t;
      const duration = path.points[i+1].t - start;
      const fullTurn = isFullTurn(step.move);
      const share = duration / path.duration;
      segment.style.left = (start / path.duration * 100) + "%";
      segment.style.width = (share * 100) + "%";
      if (share < .06) segment.classList.add("narrow");
      segment.title = "Seek to " + label(step.move) + " at " + seconds(start) +
        (fullTurn ? ". Preview duration about " + seconds(duration) : "");
      segment.setAttribute("aria-label", segment.title);
      segment.innerHTML = '<span>' + icon(step.move) + label(step.move) + '</span><small>' + (fullTurn ? "~" : "") + seconds(duration) + '</small>';
      segment.onclick = () => { pause(); seek(start); };
      line.append(segment);
    });
    cursor = document.createElement("div"); cursor.className = "time-cursor"; cursor.hidden = true; line.append(cursor);
    const divisions = path.duration < 1 ? 2 : 5;
    for (let i=0;i<=divisions;i++) {
      const tick = document.createElement("span"), value = path.duration * i / divisions;
      tick.textContent = (Number.isInteger(value) ? value : Number(value.toFixed(2))) + "s"; $("ticks").append(tick);
    }
  }
  function refreshSketch() {
    const problem = mission.validate(steps,mode);
    const runProblem = mission.validateOptions(runOptions);
    $("sketch-code").textContent = problem || runProblem || mission.generate(steps,mode,runOptions);
    const runLabel = (runOptions.startControl === "web" ? "Hotspot Start" : "Auto-start") + " · wait " + runOptions.startupDelaySeconds + " s · " + (runOptions.repeatEnabled ? "repeat " + runOptions.repeatIntervalSeconds + " s" : "one run");
    $("sketch-meta").textContent = ["ESP32 Dev Module",mode,steps.length + " movements",totalTime(),runLabel,"MAVLink 2 · 20 Hz"].join("   /   ");
    $("download-code").disabled = $("copy-code").disabled = Boolean(problem || runProblem);
  }
  function renderEditor() {
    path = mission.trajectory(steps); elapsed = 0; activeIndex = -1;
    hasFullTurns = steps.some(step => isFullTurn(step.move));
    hasTimedTurns = steps.some(step => mission.moves[step.move].yaw && !isFullTurn(step.move));
    $("heading-readout").hidden = !hasTimedTurns && !hasFullTurns;
    $("mission-title").textContent = name; updateMode(); $("scrubber").max = path.duration || 1;
    $("total").textContent = seconds(path.duration);
    $("total-label").textContent = hasFullTurns ? "Preview duration" : "Total duration";
    $("time-column").textContent = hasFullTurns ? "Time" : "Duration";
    $("leg-counter").textContent = steps.length + (steps.length === 1 ? " movement" : " movements");
    $("start-control").value = runOptions.startControl;
    $("repeat-enabled").checked = runOptions.repeatEnabled;
    $("repeat-interval").value = runOptions.repeatIntervalSeconds;
    $("repeat-interval").disabled = !runOptions.repeatEnabled;
    $("startup-delay").value = runOptions.startupDelaySeconds;
    $("ap-ssid").value = runOptions.apSsid;
    $("ap-password").value = runOptions.apPassword;
    $("auto-start-note").textContent = runOptions.startControl === "web"
      ? "Join the ESP32 hotspot and tap Start after the tube is sealed."
      : "Starts automatically after the Pixhawk startup wait.";
    $("run-warning").textContent = runOptions.startControl === "web"
      ? (runOptions.repeatEnabled
        ? "Join the protected hotspot and tap Start after sealing the tube. The sequence repeats every " + runOptions.repeatIntervalSeconds + " seconds until Stop. Wi-Fi will not reach the vehicle underwater, so Stop is available only while the ESP32 is in range."
        : "Join the protected hotspot and tap Start after sealing the tube. The sequence runs once and then disarms. Wi-Fi will not reach the vehicle underwater.")
      : "Auto-start can arm and run the thrusters after power-up. The hotspot Stop button works only while the ESP32 is in Wi-Fi range.";
    $("hotspot-credentials").textContent = "Wi-Fi: " + runOptions.apSsid + " · Password: " + runOptions.apPassword + " · Control page: http://192.168.4.1/";
    $("add-step").disabled = steps.length >= 100;
    $("steps").replaceChildren(); stepRows = [];
    steps.forEach((step,i) => {
      const row = document.createElement("li"); row.className = "step " + step.move;
      const edit = document.createElement("button"); edit.className = "step-main";
      const fullTurn = isFullTurn(step.move);
      const time = seconds(step.seconds) + (fullTurn ? " limit" : "");
      const input = fullTurn ? step.power + "% max yaw input"
        : step.move === "hold" ? "Neutral input" : step.power + (mission.moves[step.move].yaw ? "% yaw input" : "% input");
      edit.setAttribute("aria-label","Edit step " + (i+1) + ", " + label(step.move) + (fullTurn ? ", " + time + ", " + input : ""));
      edit.title = "Edit " + label(step.move);
      edit.innerHTML = '<span class="ordinal">' + String(i+1).padStart(2,"0") + '</span><span class="move-icon">' + icon(step.move) + '</span><span class="step-label">' + label(step.move) + '<small>' + input + '</small></span><span class="step-duration">' + time + '</span>';
      edit.onclick = () => openStep(i);
      const more = document.createElement("button"); more.className = "icon-button step-menu";
      more.title = "Step " + (i+1) + " actions"; more.setAttribute("aria-label",more.title); more.setAttribute("aria-haspopup","true");
      more.innerHTML = icon("dots");
      more.onclick = event => {event.stopPropagation();openMenu(i,more);};
      row.append(edit,more); $("steps").append(row); stepRows.push(row);
    });
    if (!steps.length) $("steps").innerHTML = '<li class="empty-steps">Your sequence is empty.</li>';
    renderTimeline(); pause(); drawTime();
    if (!$("sketch-view").hidden) refreshSketch();
  }
  function commit() { save(); renderEditor(); }
  $("mode-select").onchange = event => {mode=event.target.value;commit();toast(mode + " · " + modeNotes[mode]);};
  $("start-control").onchange = event => {runOptions.startControl=event.target.value;commit();};
  $("repeat-enabled").onchange = event => {runOptions.repeatEnabled=event.target.checked;commit();};
  $("repeat-interval").onchange = event => {
    const value=Number(event.target.value);
    if (!Number.isInteger(value) || value < 1 || value > 3600) {
      event.target.value=runOptions.repeatIntervalSeconds;
      toast("Repeat pause must be a whole number from 1 to 3600 seconds.");
      return;
    }
    runOptions.repeatIntervalSeconds=value;commit();
  };
  $("startup-delay").onchange = event => {
    const value=Number(event.target.value);
    if (!Number.isInteger(value) || value < 0 || value > 120) {
      event.target.value=runOptions.startupDelaySeconds;
      toast("Startup wait must be a whole number from 0 to 120 seconds.");
      return;
    }
    runOptions.startupDelaySeconds=value;commit();
  };
  $("ap-ssid").onchange = event => {
    const value=event.target.value.trim();
    if (!/^[A-Za-z0-9_-]{1,31}$/.test(value)) {
      event.target.value=runOptions.apSsid;
      toast("Hotspot name: 1–31 letters, numbers, hyphens, or underscores.");
      return;
    }
    runOptions.apSsid=value;commit();
  };
  $("ap-password").onchange = event => {
    const value=event.target.value.trim();
    if (!/^[A-Za-z0-9_-]{8,63}$/.test(value)) {
      event.target.value=runOptions.apPassword;
      toast("Hotspot password needs 8–63 letters, numbers, hyphens, or underscores.");
      return;
    }
    runOptions.apPassword=value;commit();
  };
  function showTab(generated) {
    closeMenu();
    if (generated) { pause(); togglePreview(false); refreshSketch(); }
    $("editor-view").hidden = generated; $("sketch-view").hidden = !generated;
    for (const [id,active] of [["editor-tab",!generated],["sketch-tab",generated]]) {
      $(id).classList.toggle("active",active);
      if (active) $(id).setAttribute("aria-current","page"); else $(id).removeAttribute("aria-current");
    }
    if (!generated) requestAnimationFrame(drawTime);
  }
  $("editor-tab").onclick = () => showTab(false);
  $("sketch-tab").onclick = () => showTab(true);

  const choices = ["forward","backward","left","right","up","down","yawLeft","yawRight","spinLeft","spinRight","hold"];
  function updateTurnEstimate() {
    const note = $("turn-estimate");
    const isTurn = Boolean(mission.moves[editingMove].yaw);
    note.hidden = !isTurn;
    if (!isTurn) return;
    const duration = $("step-seconds").valueAsNumber;
    const power = $("step-power").valueAsNumber;
    const valid = $("step-seconds").validity.valid && $("step-power").validity.valid;
    if (isFullTurn(editingMove)) {
      note.textContent = "Tracks heading to complete one 360° turn. The mission aborts if the time limit expires.";
      if (valid) {
        const preview = mission.trajectory([{move:editingMove,seconds:duration,power}]).duration;
        note.textContent += " Preview duration is about " + seconds(preview) + (preview > duration ? ", above the time limit." : ".");
      }
      return;
    }
    note.textContent = valid
      ? "Estimated turn of " + Number((duration * power / 100 * mission.nominalYawRateDegPerSecond).toFixed(2)) +
        "° " + turnDirection(editingMove) + ". The sketch sends timed yaw input."
      : "Enter a valid duration and yaw input to estimate the turn.";
  }
  function updateChoices() {
    $("move-choices").replaceChildren();
    for (const key of choices) {
      const button = document.createElement("button"); button.type = "button";
      button.className = "move-choice " + key; button.dataset.move = key;
      button.setAttribute("aria-pressed",String(key === editingMove));
      if (mission.moves[key].yaw) {
        const direction = turnDirection(key);
        const description = isFullTurn(key) ? "360° " + direction : direction;
        button.setAttribute("aria-label",label(key) + ", " + description);
        button.innerHTML = icon(key) + "<span>" + label(key) + "<small>" +
          description[0].toUpperCase() + description.slice(1) + "</small></span>";
      } else button.innerHTML = icon(key) + label(key);
      button.onclick = () => {
        if (editingMove === key) return;
        if (isFullTurn(editingMove) !== isFullTurn(key)) useDefaultDuration = true;
        editingMove = key; setPower(mission.moves[key].power);
        if (useDefaultDuration) $("step-seconds").value = mission.moves[key].seconds;
        updateChoices();
        $("move-choices").querySelector('[data-move="'+key+'"]').focus();
      };
      $("move-choices").append(button);
    }
    $("power-field").hidden = editingMove === "hold";
    $("step-power").disabled = editingMove === "hold";
    const fullTurn = isFullTurn(editingMove);
    $("seconds-label").textContent = fullTurn ? "Time limit" : "Duration";
    const inputLabel = fullTurn ? "Max yaw input" : mission.moves[editingMove].yaw ? "Yaw input" : "Pilot input";
    $("input-label").textContent = inputLabel;
    $("power-slider").setAttribute("aria-label",inputLabel + " percentage");
    updateTurnEstimate();
  }
  function setPower(value) { $("step-power").value = value || 1; $("power-slider").value = value || 1; }
  $("step-seconds").oninput = () => { useDefaultDuration = false; updateTurnEstimate(); };
  $("step-power").oninput = () => { $("power-slider").value = $("step-power").value; updateTurnEstimate(); };
  $("power-slider").oninput = () => { $("step-power").value = $("power-slider").value; updateTurnEstimate(); };
  function openStep(index) {
    pause(); closeMenu(); editingIndex = index; useDefaultDuration = index < 0;
    const step = index < 0 ? {move:"forward",...mission.moves.forward} : steps[index];
    editingMove = step.move; $("step-seconds").value = step.seconds; setPower(step.power);
    $("step-dialog-title").textContent = index < 0 ? "Add movement" : "Edit movement " + String(index+1).padStart(2,"0");
    $("apply-step").textContent = index < 0 ? "Add movement" : "Save changes";
    $("step-issue").textContent = ""; updateChoices(); $("step-dialog").showModal();
  }
  $("add-step").onclick = () => openStep(-1);
  $("step-form").onsubmit = event => {
    event.preventDefault();
    const step = {move:editingMove, seconds:$("step-seconds").valueAsNumber, power:editingMove === "hold" ? 0 : $("step-power").valueAsNumber};
    const next = steps.slice();
    if (editingIndex < 0) next.push(step); else next[editingIndex] = step;
    const problem = mission.validate(next,mode);
    if (problem) { $("step-issue").textContent = problem; return; }
    steps = next; $("step-dialog").close(); commit();
  };
  function closeMenu(){ $("action-menu").hidden = true; menuIndex = -1; }
  function openMenu(index,anchor) {
    const menu = $("action-menu");
    if (!menu.hidden && menuIndex === index) {closeMenu();return;}
    pause(); menuIndex = index; menu.replaceChildren();
    const options = [
      ["pencil","Edit movement",true,() => openStep(index)],
      ["up","Move earlier",index>0,() => {[steps[index-1],steps[index]]=[steps[index],steps[index-1]];commit();}],
      ["down","Move later",index<steps.length-1,() => {[steps[index+1],steps[index]]=[steps[index],steps[index+1]];commit();}],
      ["copy","Duplicate",steps.length<100,() => {steps.splice(index+1,0,{...steps[index]});commit();}],
      ["trash","Remove",true,() => {steps.splice(index,1);commit();}]
    ];
    for (const [symbol,caption,enabled,perform] of options) {
      const button = document.createElement("button"); button.disabled = !enabled; button.className = symbol === "trash" ? "danger" : "";
      button.innerHTML = icon(symbol) + caption; button.onclick = () => { closeMenu();perform(); }; menu.append(button);
    }
    menu.hidden = false;
    const rect = anchor.getBoundingClientRect();
    menu.style.left = Math.max(6,Math.min(innerWidth-menu.offsetWidth-6,rect.right-menu.offsetWidth)) + "px";
    menu.style.top = Math.max(6,Math.min(innerHeight-menu.offsetHeight-6,rect.bottom+3)) + "px";
    menu.querySelector("button").focus();
  }
  document.addEventListener("click",event => {if (!event.target.closest("#action-menu,.step-menu")) closeMenu();});
  document.addEventListener("keydown",event => {if (event.key === "Escape") { closeMenu();togglePreview(false); }});
  window.addEventListener("resize",closeMenu); document.addEventListener("scroll",closeMenu,true);
  $("presets").onclick = () => {pause();$("presets-dialog").showModal();};
  document.querySelectorAll("[data-preset]").forEach(button => {button.onclick = () => {
    const preset = button.dataset.preset;
    if (preset === "tank") {name = "Tank maneuver";steps = mission.defaults();}
    else if (preset === "ascent") {name = "Vertical ascent";steps = [{move:"up",seconds:10,power:50}];}
    else {name = "Untitled mission";steps = [];}
    mode = "STABILIZE";resetCamera();$("presets-dialog").close();commit();
  };});
  $("rename").onclick = () => {$("mission-name").value=name;$("rename-dialog").showModal();$("mission-name").select();};
  $("rename-form").onsubmit = event => {
    event.preventDefault();const value=$("mission-name").value.trim();
    if (!value) {$("mission-name").focus();return;}
    name=value;$("mission-title").textContent=name;save();$("rename-dialog").close();
  };
  document.querySelectorAll("[data-close]").forEach(button => {button.onclick=() => $(button.dataset.close).close();});

  function downloadSketch() {
    const problem = mission.validate(steps,mode) || mission.validateOptions(runOptions);
    if (problem) {toast(problem);return;}
    const url = URL.createObjectURL(new Blob([mission.generate(steps,mode,runOptions)],{type:"text/plain;charset=utf-8"}));
    const a = document.createElement("a");a.href=url;a.download="AuvMission.ino";document.body.append(a);a.click();a.remove();setTimeout(() => URL.revokeObjectURL(url),3000);
  }
  $("download-code").onclick = $("export-download").onclick = downloadSketch;
  const localServer = location.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) &&
    ["/", "/index.html"].includes(location.pathname);
  const hosted = location.protocol !== "file:" && !localServer;
  function updateExportIntro() {
    const repeatSummary = runOptions.repeatEnabled
      ? " It repeats " + runOptions.repeatIntervalSeconds + " seconds after successful disarm until you tap Stop."
      : " It runs once, then disarms.";
    $("export-intro").textContent = runOptions.startControl === "web"
      ? "Join Wi-Fi " + runOptions.apSsid + " with password " + runOptions.apPassword + ", open http://192.168.4.1/, and tap Start Sequence after sealing the tube. The page is available only while the ESP32 is in Wi-Fi range." + repeatSummary
      : "This sketch starts automatically after a " + runOptions.startupDelaySeconds + " second wait for a live, disarmed Pixhawk heartbeat." + repeatSummary + " The ESP32 hotspot Stop button is available while in Wi-Fi range.";
  }
  if (hosted) {
    $("export-label").textContent = $("export-title").textContent = "Export sketch";
    $("local-upload").hidden = true;
    $("hosted-upload").hidden = false;
  }
  $("copy-code").onclick = async () => {
    try {await navigator.clipboard.writeText(mission.generate(steps,mode,runOptions));toast("Sketch copied");}
    catch {const range=document.createRange();range.selectNodeContents($("sketch-code"));const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);toast("Sketch selected. Use Ctrl+C to copy.");}
  };
  function buildControls() {
    const valid=!mission.validate(steps,mode) && !mission.validateOptions(runOptions);
    $("refresh-ports").disabled = building || checkingPorts || !localServer;
    $("port").disabled=building || checkingPorts || !connection?.ports.length;
    $("verify").disabled=building || checkingPorts || !connection?.canBuild || !valid;
    $("upload").disabled=$("verify").disabled || !$("port").value;
    $("export-download").disabled=!valid;
    $("close-export").disabled=building;
  }
  async function refreshPorts() {
    if (building || checkingPorts || hosted) return;
    const oldPort=$("port").value;
    $("port").replaceChildren(new Option("Select the ESP32 port",""));
    connection=null;checkingPorts=true;buildControls();
    try {
      if (location.protocol==="file:") throw new Error("Open Launch DivePlan.cmd to enable USB upload and sketch verification.");
      $("connection-status").textContent="Looking for ESP32 USB adapters…";
      const response=await fetch("/api/info",{cache:"no-store"});
      if (!response.ok) throw new Error("The local uploader is unavailable. Open Launch DivePlan.cmd to connect.");
      const info=await response.json();
      if (!Array.isArray(info.ports) || typeof info.token!=="string") throw new Error("Open Launch DivePlan.cmd to enable the local uploader.");
      connection=info;
      for(const port of info.ports) $("port").append(new Option(port.label,port.port));
      if(info.ports.some(p=>p.port===oldPort)) $("port").value=oldPort;
      $("connection-status").textContent= !info.canBuild || /failed/i.test(info.detail) ? info.detail : info.ports.length ? "With the Pixhawk disarmed, select the USB adapter connected to your ESP32." : "No ESP32 USB adapter found. Connect the ESP32 and refresh.";
    } catch(error) { $("connection-status").textContent=error.message; }
    finally {checkingPorts=false;buildControls();}
  }
  $("refresh-ports").onclick=refreshPorts; $("port").onchange=buildControls;
  $("open-export").onclick=() => {
    pause();closeMenu();
    updateExportIntro();
    $("export-meta").textContent = steps.length ? mode + " · " + steps.length + (steps.length===1?" movement · ":" movements · ") + totalTime() : "Add a movement to export this mission.";
    $("build-log").hidden=true;$("export-dialog").showModal();buildControls();refreshPorts();
  };
  $("export-dialog").addEventListener("cancel",event=>{if(building)event.preventDefault();});
  async function build(action) {
    if (!localServer || building || !connection?.canBuild || mission.validate(steps,mode) || mission.validateOptions(runOptions) || (action==="upload" && !$("port").value)) return;
    const selectedPort=$("port").value, payload={steps,mode,action,options:runOptions};
    if(action==="upload") payload.port=selectedPort;
    building=true;buildControls();
    const log=$("build-log");log.hidden=false;
    log.textContent=action==="verify" ? "Compiling for ESP32 Dev Module…" : "Compiling, then uploading to " + selectedPort + "…";
    $("connection-status").textContent=log.textContent;
    try {
      const response=await fetch("/api/build",{method:"POST",headers:{"Content-Type":"application/json","X-DivePlan-Token":connection.token},body:JSON.stringify(payload)});
      const result=await response.json();
      if (!response.ok || !result.ok) throw new Error(result.log || "The build failed.");
      log.textContent=result.log;
      $("connection-status").textContent=action==="verify" ? "Sketch verified for ESP32 Dev Module." : "Upload complete on " + selectedPort + ". Hotspot " + runOptions.apSsid + "; open http://192.168.4.1/ for control.";
    } catch(error) {log.textContent=error.message;$("connection-status").textContent=action==="upload" ? "Upload could not be confirmed. Check the tool output below." : "Verification failed. Check the tool output below.";}
    finally {building=false;buildControls();}
  }
  $("verify").onclick=()=>build("verify"); $("upload").onclick=()=>build("upload");
  renderEditor();save();
})();
