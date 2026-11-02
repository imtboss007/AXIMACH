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
- Electron diagnostics and recovery screen. Packaged local service scripts are externalised from ASAR and receive their own ESM dependency installation so child processes can resolve Baileys and QR dependencies. The Windows pipeline now launches the packaged unpacked application in a headless renderer smoke-test mode and checks that the React root renders.

## Engineering and data boundaries (important)
- Fluid/cloth/soft-body effects are interactive visual demonstrations, not validated CFD, textile or finite-element engineering solvers.
- Post-processing currently uses SSAO + bloom + physically based materials. This is **not hardware ray tracing or path tracing**.
- Scenario outputs are deterministic what-if calculations from user-entered assumptions, not an ML forecast and not based on live shop-floor telemetry.
- Spatial dashboard values come from saved AXIMACH record counts. They are not live factory sensor metrics.
- The machine connection panel stores a protocol/asset/endpoint profile only. It does not open network sockets or read/write controllers. A complete CNC/PLC digital twin still requires the actual machine models and allowed signals, protocol/gateway, addressing, credentials/certificates, network access and a safe read-only integration test plan. No readings or machine states are fabricated.
- A CI smoke test checks the packaged Electron renderer in a Windows runner. It is not a physical test on the user's PC. The Android job installs and launches the APK in an Android emulator, but that is not a physical test on the user's phone; device GPU, touch, notification, safe-area and cross-device sync still need the target phone.

## Verification status
- Feature branch CI type-check and production build: verify against the latest branch-head Actions run.
- Windows x64 installer and Android debug APK: generated only when the corresponding package jobs pass.
- Packaged Windows Electron startup smoke test: added to the Windows package job; its result must be checked on the latest successful run.
- Physical Windows and Android device testing remains outstanding until the user's machines/devices are available.
