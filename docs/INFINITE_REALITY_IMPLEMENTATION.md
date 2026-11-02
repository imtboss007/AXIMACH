# AXIMACH Infinite Reality — implementation and verification

## Integrated in this feature branch
- Existing AXIMACH modules, records, IDs, server sync and manufacturing workflows are retained.
- Electron startup diagnostics and visible renderer recovery for missing packaged entry files, load failures and renderer crashes.
- Lazy-loaded Three.js WebGL orb: physical 3D core, surface wireframe, molecular point layer, independently animated orbital rings, 3D module nodes, raycast selection, mouse/touch rotation, pinch/scroll zoom, camera reset, performance tiers and fallback to the legacy orb.
- Orb quantities derive from saved company, purchase-order-line, inventory transaction and operation records.
- Multi-dashboard Command Theatre with record-derived panels, domain views, drag reorder, pin, minimise, maximise, resize and saved layout.
- Visual Experience Studio with live preview, motion, depth, particles, lighting, reflections, transition, camera, haptic, reduced-motion and performance settings. Preferences persist locally and synchronise through a separate authenticated endpoint when the shared AXIMACH server is configured.
- Existing Icon Studio and process graph workflows remain in place.

## Remaining limitations
Advanced fluid/cloth/soft-body physics, all transition families, ray-traced post-processing, spatially rotating dashboard planes, full digital-twin models and predictive scenario visualisations are not all delivered by this branch. The 3D core is a visual navigation surface, not a connected machine digital twin. There is no live CNC/PLC telemetry adapter in this implementation.
The Windows recovery screen adds diagnostics and prevents silent blank failure, but a launch test on a target Windows PC is still needed to prove the reported black-screen symptom is resolved on affected hardware.
The Android APK is a CI build artifact; installation and physical touch testing remain necessary.

## Verification
- CI type-check and production build.
- CI Windows installer and Android APK packaging.
- Windows installer launch and startup-log inspection on a physical Windows PC.
- Android installation, touch/safe-area and cross-device sync tests.
- Repeated module navigation and GPU-memory profiling on low/medium/high quality devices.
