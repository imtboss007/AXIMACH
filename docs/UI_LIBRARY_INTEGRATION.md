# AXIMACH UI library integration notes

## Goal

Give AXIMACH a coherent sphere-centred manufacturing control-room interface while retaining the existing React 19 + Vite + TypeScript + Motion stack, approved navigation, manufacturing records and operational workflows.

## Sources reviewed

- Vengeance UI — https://www.vengenceui.com/
- Animate UI — https://animate-ui.com/docs/react
- Uiverse — https://uiverse.io/
- ForgeUI — https://forgeui.in/docs/introduction
- Uilora — https://www.uilora.com/
- Lora Design System (`lora-ds`) — https://www.npmjs.com/package/lora-ds

“UI Lora” can refer to two different sources: Uilora is a copy-source web/mobile component library, while `lora-ds` is a React design system built around React Aria. They are separate projects. These sources are not one shared component framework. AXIMACH therefore adopts compatible interaction and composition patterns in its own source rather than importing multiple competing design systems wholesale.

## AXIMACH implementation

- `src/AXIMACHOrb.tsx` and `src/AXIMACHOrbWebGL.tsx`: true Three.js/WebGL sphere by default, drag rotation, pinch/scroll zoom, ray-cast orbital navigation, real saved-record counts, adaptive rendering quality, motion speed, size, orbit intensity, pause and reduced-motion setting. A CSS sphere fallback remains for devices where WebGL cannot initialise.
- `src/aximach-premium.css`: sphere material, orbital ring and responsive layouts; shared component interaction states; tactile press/hover feedback; layered glass and bento surfaces; reduced-motion fallbacks.
- `src/App.tsx`: sphere is placed in the existing dashboard hero. The saved-record `DashboardFlow3D` remains visible in a separate section below it.
- Sphere satellites route to approved modules: Companies, Production Planning / Process Map, Material & Inventory, Quality & Inspection, Dispatch & Delivery, and Component Cost Planner.

## Pattern mapping

| Reference | Pattern adopted in AXIMACH |
|---|---|
| Vengeance UI | Animated action states, luminous hover feedback and expressive interaction on existing controls |
| Animate UI | Motion-based entrance, spring-like transitions and reduced-motion-aware behavior using the installed `motion` package |
| Uiverse | Tactile button depth, layered hover states, focus rings and pressed feedback |
| ForgeUI | Structured control-room panels, grouped actions, consistent card hierarchy and responsive work areas |
| Uilora | Spatial surfaces, subtle depth, interaction feedback and responsive presentation polish |
| Lora DS (`lora-ds`) | Accessible interaction principles: semantic controls, keyboard focus, dialog semantics, clear labels and visible focus states; adapted to existing native controls rather than adding a second component runtime |

## Compatibility and preservation

- No Tailwind, Next.js, Radix, React Aria or additional UI runtime was added solely to consume copy-paste examples. The Lora DS accessibility patterns are adapted to AXIMACH's native React controls; the `lora-ds` package itself is not installed.
- No upstream component source bundle was copied wholesale. The implementation is AXIMACH-owned React/CSS adapted to the present application.
- Existing module IDs and data routes are unchanged by the sphere. It is a navigation/presentation layer, not a second source of manufacturing records.
- Sphere presentation preferences are stored separately under `aximach.orb.preferences.v1`; WebGL quality settings can read `aximach.visual-experience.v1`. They do not mutate production, costing, inventory, quality or dispatch records.
- The default sphere is an actual Three.js `SphereGeometry` scene with physical material, torus orbit rings, point/star particles, ray-cast module nodes, pointer/touch rotation, pinch and wheel zoom. Module counters are derived from saved AXIMACH companies, operations, inventory transactions, inspections, WIP/customer dispatches and components.
- Three.js and its matching TypeScript declarations are pinned to the same release line (`three` and `@types/three` `^0.187.0`).
- The default sphere is genuine WebGL. The selectable cube/vortex/molecular/orbit/mesh appearance variants remain CSS/transform presentation modes, not independent WebGL geometries or engineering simulations.
- Review the source libraries' current licences and attribution requirements before copying any specific upstream component code into a distributable build.

## Acceptance checks still required

- Run the TypeScript/Vite production build and Windows/Android package jobs on the exact final commit.
- Check keyboard/focus navigation, reduced motion, narrow Android viewport layout and touch drag on a physical device.
- Test sphere satellite navigation against the approved menu list.
- Confirm the retained DashboardFlow3D route still opens the selected saved operation.
- Test local preference persistence and the existing shared manufacturing-data sync independently.
