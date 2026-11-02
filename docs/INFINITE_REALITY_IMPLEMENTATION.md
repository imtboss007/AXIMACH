# AXIMACH Infinite Reality — implementation notes

This branch is based on the latest main snapshot and upgrades the existing app. It does not replace manufacturing records, route logic, stable IDs, sync contracts or workspaces.

## Windows renderer recovery
Electron now logs startup and renderer failures to the application user-data `logs/startup.log`. Missing packaged renderer assets, failed main-frame navigation, renderer crashes and fatal startup exceptions show a recovery screen with a retry action rather than silently leaving a blank dark window.

This is defensive recovery handling, not proof that the previous Windows 0.4.0 issue is fixed on every machine. A packaged installer must still be launched and tested on Windows.

## Visual foundation
The additive `axr-*` tokens establish the spatial glass, depth, lighting, grid and reduced-motion primitives. Existing visual styles remain in place until each workspace is migrated and regression-tested.

## Capability truth
The current AXIMACH orb and process universe are interactive CSS/DOM 3D-style surfaces, not a complete WebGL industrial simulation. Machine telemetry and predictive analytics must only be presented as live when connected to real sources. Visual-only route playback remains labelled as simulation.

## Remaining release verification
- CI type-check and production build.
- Packaged Windows installer launch on a Windows machine.
- GPU/WebGL fallback and repeated-navigation memory profiling.
- Android touch, safe-area, haptic capability and APK installation tests.
- Data persistence, PC/mobile sync and manufacturing workflow regression.
