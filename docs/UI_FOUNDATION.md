# AXIMACH UI Foundation

AXIMACH remains the source application. The UI repositories below are references and selected component foundations; their complete demo applications are not copied over the AXIMACH business logic.

## Selected foundations

| Project | AXIMACH use |
| --- | --- |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Composable component boundaries, accessible dialog patterns, keyboard interaction and design-token discipline. Adapted to the existing Vite + React + custom-CSS stack rather than adding a second full styling system. |
| [Magic UI](https://github.com/magicuidesign/magicui) | Manufacturing-orbit hero, animated grid, orbiting workspace nodes and visual emphasis. |
| [Motion](https://github.com/motiondivision/motion) | React entrance transitions, spring-based motion, hover/tap feedback and drag interaction for the interactive AXIMACH sphere. |
| [Motion Primitives](https://github.com/ibelick/motion-primitives) | Reusable motion patterns, staggered reveal, layout transitions and compact interaction feedback. |
| [Cult UI](https://www.cult-ui.com/docs) | Halo-style illuminated surfaces, customisable preview controls and shader-inspired hero treatment. |
| [Tabler Icons](https://github.com/tabler/tabler-icons) | Full icon catalogue (5,203 outline glyphs in v3.50.0), searchable icon studio and process-family assignments with 3D material treatments. |

## Implementation rules

- Preserve AXIMACH routes, saved manufacturing records, server sync contracts and business workflows.
- Use only selected UI components or interaction patterns; do not import complete demo apps, reset project configuration, or replace the existing navigation.
- Keep visual animation lightweight and honour reduced-motion preferences. Do not make animation the only way to understand state.
- Keep icon selection as a user preference, with fallback icons when no custom assignment is saved.
- Tabler Icons and the Tabler webfont are MIT-licensed. Re-check upstream component licenses before copying additional source from any repository.
