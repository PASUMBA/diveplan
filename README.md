# DivePlan

DivePlan builds MAVLink movement sequences for an eight-thruster Vectored 6DOF AUV with an ESP32 companion and a Pixhawk running ArduSub. It opens with the original tank maneuver and includes the ten-second ascent as a preset.

## Open the app

Open the editor to build a sequence and play its 3D preview in your browser. Choose **Export sketch** to download **AuvMission.ino** for Arduino IDE. [Launch DivePlan](https://pasumba.github.io/diveplan/)

For direct USB upload from DivePlan on Windows, choose **Export sketch → Download DivePlan for Windows** on the site. Right-click the ZIP and select **Extract All**. In the extracted **DivePlan** folder, double-click **Launch DivePlan.cmd** and keep its window open while using the uploader. Keep the launcher and its app files together. You can also open **index.html** from the extracted folder to edit and export sketches offline.

## Build and preview a sequence

1. Select the mission’s flight mode. **Stabilize** is the default used on the tested vehicle. **Manual** gives direct pilot control. **Acro** controls body rotation rates. All three use manual depth control. [ArduSub flight modes](https://ardupilot.org/sub/docs/modes.html)
2. Click a movement to edit its settings. **Rotate right** and **Rotate left** apply yaw input for a set time. **Full turn right** and **Full turn left** target one 360° revolution in place. Right is clockwise when viewed from above. On a full turn, **Time limit** is the maximum allowed time and **Max yaw input** caps the pilot command. The **…** menu reorders, duplicates, or removes a step.
3. Press **Play** or click a segment on the timeline. Drag the 3D view to orbit, scroll to zoom, or select **Top** to watch a turn. Preview turns use an illustrative rate of 90°/s at full yaw input. The full-turn preview always shows one revolution and estimates its duration. The vehicle can drift during a turn or **Hold neutral** because it has no position or depth feedback.
4. The editor saves the current sequence, name, and flight mode in this browser at the address you used. The GitHub Pages site and the local launcher each have their own saved workspace.

## Compile and upload

Direct upload uses Node.js 20 or newer and Arduino CLI on the Windows computer. The tested toolchain uses the **ESP32 Dev Module** board, Espressif Arduino core **3.2.0**, and **MAVLink** Arduino library **2.0.35**. [MAVLink Arduino library](https://github.com/okalachev/mavlink-arduino)

1. Open **Export & upload** and select **Verify sketch** to compile the current sequence and flight mode.
2. With the Pixhawk disarmed, connect the ESP32 over USB. Close any serial monitor holding its port and select **Refresh**. Choose the ESP32 adapter and click **Upload to ESP32**. Windows may assign a different COM port after reconnecting.
3. Alternatively, download **AuvMission.ino** and open it in Arduino IDE. Accept the prompt to create the matching **AuvMission** sketch folder if shown, select **ESP32 Dev Module** and the ESP32 port, and upload.
4. **Auto-start is enabled by default.** On boot, the ESP32 waits for a live, disarmed ArduSub heartbeat, checks the pilot failsafe, home, selected mode, and heading telemetry when the plan has a full turn, then runs the sequence. After a successful sequence and confirmed disarm, it waits **20 seconds** and repeats. This is a 20-second pause between runs, so the time from one start to the next is the sequence duration plus the pause. The editor lets you turn auto-start off or change the pause from 1 to 3600 seconds.

   In the serial monitor at **115200 baud**, `status` reports the link, armed state, and auto-run setting. `stop` disarms an active run and disables repeats; `auto` re-enables them. A preflight or movement fault also stops auto-run until `auto` is sent or the ESP32 is restarted. If the Pixhawk is already armed when the ESP32 boots, auto-start cancels; disarm it and send `auto` when ready. With auto-start turned off in DivePlan, `start` runs the sequence once and `prepare` checks readiness without running it. The `up` and `up10` shortcuts remain single-run STABILIZE commands. Keep the propulsion cutoff accessible. **With auto-start enabled, a reboot can arm and move the thrusters as soon as the Pixhawk is ready.**

The sketch uses GPIO16/GPIO17 for the Pixhawk TELEM2 link at **57600 baud** and sends pilot input at **20 Hz**. It uses normal arming, checks the live mode heartbeat, and preserves the pilot-loss disarm behavior from the working firmware. The mode selector applies to the complete exported sequence.

For a mission with a full turn, the ESP32 requests Pixhawk attitude telemetry before arming. It follows the change in yaw through the ±180° boundary, reduces input near the target, and ends the turn within 5° of the measured target. Loss of fresh heading data or expiry of the time limit stops the mission and requests disarm. The vehicle can coast after neutral input. [ArduPilot telemetry requests](https://ardupilot.org/dev/docs/mavlink-requesting-data.html)
