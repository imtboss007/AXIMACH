# AXIMACH Infinite Reality — implementation and verification

## Delivered in this feature branch
- Existing AXIMACH modules, records, IDs, server sync, manufacturing workflows, Process Map, dashboard theatre and Icon Studio are retained.
- Lazy-loaded Three.js WebGL navigation core with physical 3D materials, orbital rings, raycast-selected module nodes, touch/mouse rotation, pinch/scroll zoom, adaptive quality, reduced-motion support and fallback to the original orb.
- Infinite Reality Lab, opened from the 3D core:
  - Fluid-field particle advection visualisation.
  - Cloth mesh with pinned edge, Verlet integration, distance constraints and pointer interaction.
  - Soft-body surface deformation and elastic return.
  - Spatial dashboard planes rotating in a 3D scene, showing record counts sourced from saved AXIMACH data.
  - Six cinematic camera families: orbit sweep, fly-through, dolly zoom, axial roll, whip pan and depth shift.
  - Screen-space ambient occlusion (SSAO), bloom, ACES tone mapping, physical materials and final output pass.
  - Responsive layout and WebGL fallback message.
- Predictive scenario lab with editable cycle rate, shift hours, availability, downtime, scrap and order quantity; it calculates a baseline and explicit upside/stress cases.
- Existing Icon Studio extended with saved float, orbit, pulse, scan and static animation profiles. Existing palette, finish, depth and tilt options remain. Reduced-motion rules included.
- Multi-dashboard Command Theatre with record-derived panels, domain views, drag reorder, pin, minimise, maximise, resize and saved layout.
- Visual Experience Studio with live preview, motion, depth, particles, lighting, reflections, transition, camera, haptic, reduced-motion and performance settings. Preferences persist locally and synchronise through the authenticated endpoint when configured.
- Electron diagnostics and recovery screen. A Windows startup defect was identified: the Electron 37.10.3 runtime did not expose the `webContents.addDocumentStartJavaScript` method used by the prior bootstrap path. Local service settings now arrive through a sandboxed preload and restricted IPC handler. Packaged local service scripts are externalised from ASAR and receive their own ESM dependency installation so child processes can resolve Baileys and QR dependencies. The Windows pipeline launches the packaged unpacked application in smoke-test mode and checks that the React root renders.

## Engineering and data boundaries (important)
- Fluid/cloth/soft-body effects are interactive visual demonstrations, not validated CFD, textile or finite-element engineering solvers.
- Post-processing currently uses SSAO + bloom + physically based materials. This is **not hardware ray tracing or path tracing**.
- Scenario outputs are deterministic what-if calculations from user-entered assumptions, not an ML forecast and not based on live shop-floor telemetry.
- Spatial dashboard values come from saved AXIMACH record counts. They are not live factory sensor metrics.
- The Machine Twin panel now supports authenticated read-only polling through the AXIMACH local gateway for Modbus TCP function codes 03/04, OPC UA, MTConnect current-value XML and REST JSON-pointer gateways. Each profile requires an explicit signal map; displayed values come only from successful gateway reads. Modbus supports uint16/int16/uint32/int32/float32 decoding and scaling. Polling is read-only; there are no controller write, cycle-start, feed-hold or machine-control routes. TCP/HTTP targets must resolve to loopback/private-LAN addresses; public endpoints and URL-embedded credentials are rejected. OPC UA defaults to certificate-backed SignAndEncrypt; anonymous SecurityMode=None is blocked unless an administrator explicitly enables AXIMACH_ALLOW_OPCUA_NONE=1 on the gateway. OPC UA certificate/private-key and optional username/password settings, and REST headers, are read from AXIMACH_MACHINE_SECRETS_FILE, a gateway-PC-only JSON file keyed by machine profile ID. Never commit that secrets file, store secrets in the browser profile, or sync private keys/passwords to another device. Real connectivity still requires your actual machine IP/port, protocol enablement, correct signal addresses/NodeIds/dataItemIds/JSON pointers, credentials/certificates and firewall/network access. No live machine reading can be confirmed until those supplied machine details are tested against a real endpoint.
- The CI pipeline installs the NSIS Windows installer into a clean Windows runner and launches the installed executable, verifying that the React renderer mounts AXIMACH content. The Android job installs and launches the APK in an Android emulator, verifies its foreground activity/process, captures a screen and checks the crash log. These are automated virtual-device tests, not physical tests on the user's own PC or phone. Actual GPU drivers, hardware acceleration, touch gestures, display scaling, Android vendor firmware, notifications, safe areas, local network permissions and cross-device sync still require testing on the target hardware.


## Live machine gateway setup

1. Start the packaged AXIMACH desktop app on the PC that can reach the controller or approved industrial gateway. The local authenticated AXIMACH data server listens on port 8787.
2. In Infinite Reality Lab, add a machine with a private-LAN endpoint and the correct protocol-specific signal map. Save & poll performs a read-only sample; the panel can then refresh the selected profile every five seconds.
3. Configure AXIMACH_MACHINE_SECRETS_FILE in the environment of the gateway service when credentials are required. This file is local to the gateway PC, must have restrictive filesystem permissions, and is not uploaded by the browser or GitHub.
4. For OPC UA, the secrets JSON is keyed by the saved profile UUID. The corresponding entry may contain securityMode: "SignAndEncrypt", securityPolicy: "Basic256Sha256", certificateFile, privateKeyFile, and optionally username/password. For REST gateways, use a headers object for server-side headers. Never use a password or private-key field in the signal map.
5. For Modbus, only function codes 03 (holding registers) and 04 (input registers) are accepted. Confirm register addressing, unit ID, byte/word order and scaling with the machine OEM before enabling polling. The default decoding is big-endian and must not be assumed correct for every controller.
6. For MTConnect, provide an HTTP(S) current-value endpoint and the exact dataItemId values. For REST, provide an HTTP(S) endpoint and JSON Pointer paths into its JSON response.

Supported signal-map examples are shown in the Machine Twin panel and change when the protocol is selected. These adapters only read values. There is no command/control pathway. A successful connection and valid values must be demonstrated on the customer's approved machine network before production decisions rely on the data.

## Verification status
- Feature branch CI type-check and production build: verify against the latest branch-head Actions run.
- Windows x64 installer and Android debug APK: generated only when the corresponding package jobs pass.
- Packaged Windows Electron startup smoke test: added to the Windows package job; its result must be checked on the latest successful run.
- Physical Windows and Android device testing remains outstanding until the user's machines/devices are available.
