<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Game architecture

- Game rules live in `src/game/sim/` as pure TypeScript (no React/three); the turn flow is a generator (`playTurn`) that yields requests, so the UI controller (`src/game/store.ts`) and vitest share one rule path.
- The 3D scene (`src/game/scene/`) only draws store state; the `/` route uses `ssr: false` because the canvas is browser-only.
- The canvas wrapper gets `data-scene-ready` once tile textures have drawn; screenshot checks wait for it.
- Rule tests: `bunx vitest run src/game` (includes full bot-only games as invariants).
- Dev builds expose the zustand store as `window.__game` (state + actions) so browser checks can force UI states like banners.
- Transient per-frame visual impulses (camera shake, dice throw power) live in `src/game/fx.ts`, outside React state.
- Living-city visuals stay in `src/game/scene/`: GLB instances share immutable geometry/materials, normalize once per instance, and use ref-driven construction and traffic; they never write simulation state. City material colors use `--city-*` semantic CSS tokens because Three.js does not parse OKLCH.
- Scene quality defaults to the phone-safe tier (no live reflections, shadows or composer); desktop enhancement uses device hints and resolution adapts using measured frame intervals. Milestone cinematics observe existing banners in a separate presentation store and never change turn pacing; skip only dismisses visuals. Dev `window.__gamePerformance.report()/markdown()` counts all renderer passes for comparable measurements.
- Temporary board events use a deterministic round schedule separate from dice RNG; their rent modifiers are shared by payments, bots and per-level previews through `tollAtLevel`. World Cup remains a separate modifier. Event graphics are static tile markers to preserve phone performance.
- Realism comes from PBR surface detail (procedural normal maps in `textures.ts`) and shared soft blob shadows under moving pieces, so phone tier stays grounded without shadow maps. N8AO is not used: alongside drei `<Environment>` it crashed the cube render target and blanked the scene.
- Camera shots are chosen by pure rules in `scene/director.ts` (priority + which builds earn a showcase, unit-tested); `CameraRig` only eases toward the chosen shot and never affects turn pacing. Table drag captures the pointer only after a small movement threshold, because capturing on press retargets clicks away from the canvas and breaks tile picking.
- Player pieces reflect their own PMREM `RoomEnvironment` probe (built once per renderer in `Tokens.tsx`), because the table's sparse Lightformer environment leaves mirror metal nearly black; seat identity stays readable through player-coloured enamel bands and a gem.

## Combined games
- Keep Kaya Raya at `/` and 100 SUARA under `/seratus`; isolate 100 SUARA rules, presentation, assets, and audio under `src/seratus` to prevent game-state and module collisions.
- Scope imported 100 SUARA CSS through `html.seratus-app`, including portal tokens, and install its audio listeners only on its routes so Kaya Raya keeps its own appearance and sound.
- Online 100 SUARA rooms use server-validated hashed HttpOnly guest identities, server-only private tables, and revision-checked writes; direct browser table access is denied to preserve hidden votes and host permissions.
- 100 SUARA's 3D tabletop (`src/seratus/components/game/Board3D.tsx`) only draws engine state; pawn hops reuse `pawnRoute` and camera follow/shake are per-frame impulses outside React. The flat SVG board stays as the 2D toggle and hosts the hover loupe.
