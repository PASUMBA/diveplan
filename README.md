# DivePlan

DivePlan builds timed MAVLink movement sequences for an eight-thruster Vectored 6DOF AUV with an ESP32 companion and a Pixhawk running ArduSub. It opens with the original tank maneuver and includes the ten-second ascent as a preset.

## Open the app

Open the editor to build a sequence and play its 3D preview in your browser. Choose **Export sketch** to download **AuvMission.ino** for Arduino IDE. [Launch DivePlan](https://pasumba.github.io/diveplan/)

For direct USB upload from DivePlan on Windows, choose **Export sketch → Download DivePlan for Windows** on the site. Right-click the ZIP and select **Extract All**. In the extracted **DivePlan** folder, double-click **Launch DivePlan.cmd** and keep its window open while using the uploader. Keep the launcher and its app files together. You can also open **index.html** from the extracted folder to edit and export sketches offline.

## Build and preview a sequence

1. Select the mission’s flight mode. **Stabilize** is the default used on the tested vehicle. **Manual** gives direct pilot control. **Acro** controls body rotation rates. All three use manual depth control. [ArduSub flight modes](https://ardupilot.org/sub/docs/modes.html)
2. Click a movement to change its direction, duration, or pilot input. Use **Add movement** for translation, rotation, or neutral input. **Rotate right** turns clockwise as seen from above. **Rotate left** turns counterclockwise. The **…** menu reorders, duplicates, or removes a step. **Hold neutral** centers the pilot inputs for its duration. Without position and depth feedback, the real vehicle can drift.
3. Press **Play** or click a segment on the timeline. Drag the 3D view to orbit, scroll to zoom, or choose a top or side view. In the preview, movements after a rotation follow the new heading. Preview turns use an illustrative rate of 90°/s at full yaw input. The ESP32 sends timed yaw input, and the actual angle depends on ArduSub mode and the vehicle's response. The preview assumes a level vehicle and has no calibrated speed or depth model.
4. The editor saves the current sequence, name, and flight mode in this browser at the address you used. The GitHub Pages site and the local launcher each have their own saved workspace.

## Compile and upload

Direct upload uses Node.js 20 or newer and Arduino CLI on the Windows computer. The tested toolchain uses the **ESP32 Dev Module** board, Espressif Arduino core **3.2.0**, and **MAVLink** Arduino library **2.0.35**. [MAVLink Arduino library](https://github.com/okalachev/mavlink-arduino)

1. Open **Export & upload** and select **Verify sketch** to compile the current sequence and flight mode.
2. With the Pixhawk disarmed, connect the ESP32 over USB. Close any serial monitor holding its port and select **Refresh**. Choose the ESP32 adapter and click **Upload to ESP32**. Windows may assign a different COM port after reconnecting.
3. Alternatively, download **AuvMission.ino** and open it in Arduino IDE. Accept the prompt to create the matching **AuvMission** sketch folder if shown, select **ESP32 Dev Module** and the ESP32 port, and upload.
4. The firmware boots idle. In the ESP32 serial monitor at **115200 baud** with a newline, `status` reports the Pixhawk link and armed state. `prepare` checks the pilot failsafe, home, and selected mode while disarmed. For a prepared in-water test, `start` runs the exported sequence once, then requests neutral input and disarms. `stop` aborts. The existing `up` and `up10` shortcuts still use STABILIZE for two- and ten-second upward commands. Keep the independent propulsion cutoff accessible during powered operation.

The sketch uses GPIO16/GPIO17 for the Pixhawk TELEM2 link at **57600 baud** and sends pilot input at **20 Hz**. It uses normal arming, checks the live mode heartbeat, and preserves the pilot-loss disarm behavior from the working firmware. The mode selector applies to the complete exported sequence.
