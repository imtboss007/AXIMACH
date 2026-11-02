# AXIMACH UI library integration notes

## Goal

Give AXIMACH a coherent sphere-centred manufacturing control-room interface while retaining the existing React 19 + Vite + TypeScript + Motion stack, approved navigation, manufacturing records and operational workflows.

## Sources reviewed

- Vengeance UI — https://www.vengenceui.com/
- Animate UI — https://animate-ui.com/docs/react
- Uiverse — https://uiverse.io/
- ForgeUI — https://forgeui.in/docs/introduction
- Uilora — https://www.uilora.com/

These sources are not one shared component framework. Their component/runtime assumptions differ. AXIMACH therefore adopts compatible interaction and composition patterns in its own source rather than importing multiple competing design systems wholesale.

## AXIMACH implementation

- `src/AXIMACHOrb.tsx`: interactive sphere shell, drag rotation, orbital navigation, configurable presentation modes, motion speed, size, orbit intensity, pause and reduced-motion setting.
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

## Compatibility and preservation

- No Tailwind, Next.js, Radix or additional UI runtime was added solely to consume copy-paste examples.
- No upstream component source bundle was copied wholesale. The implementation is AXIMACH-owned React/CSS adapted to the present application.
- Existing module IDs and data routes are unchanged by the sphere. It is a navigation/presentation layer, not a second source of manufacturing records.
- Sphere presentation preferences are stored separately under `aximach.orb.preferences.v1`; they do not mutate production, costing, inventory, quality or dispatch records.
- The visual modes are CSS/transform-based presentation variants. They are not claimed to be independent WebGL geometries or engineering simulations.
- Review the source libraries' current licences and attribution requirements before copying any specific upstream component code into a distributable build.

## Acceptance checks still required

- Run the TypeScript/Vite production build and Windows/Android package jobs on the exact final commit.
- Check keyboard/focus navigation, reduced motion, narrow Android viewport layout and touch drag on a physical device.
- Test sphere satellite navigation against the approved menu list.
- Confirm the retained DashboardFlow3D route still opens the selected saved operation.
- Test local preference persistence and the existing shared manufacturing-data sync independently.
