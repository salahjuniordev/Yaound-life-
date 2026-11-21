# Yaoundé Life (Mboa Life: Yaoundé)

A playable 3D browser life simulator set in Yaoundé, Cameroon. Built from the
requirements in `Yaounde_Life_Ultimate_PRD_v1.1.txt`.

- Day/night cycle (1 in-game day ≈ 12 real minutes), needs, FCFA economy (cash / MoMo / bank / debt)
- 9 districts; all nine are real-geography slices with OSM roads, buildings, water and waterway lines plus Copernicus terrain
- Offline world packs: download any district pack from Settings; Nlongkak and Mvog-Mbi are precached on install, while the other seven stay on-demand; versioned caches survive app updates and removing one pack preserves the others
- Walk / shared taxi / moto with real cost, time and risk
- 8 starting backgrounds, 33 jobs, 30+ events, 13 goals, 11 achievements
- Njangi/tontine system (reliable group + fraudulent "Fast Pot" to learn from)
- Businesses with stock, pricing, staff and daily demand; delestage (power cuts) and generator economy
- Phone UI: Journal, Messages, Wallet, Jobs, Business, Njangi, News, Social, Contacts, Glossary, Stats, Settings
- English + French UI, optional Camfranglais flavor, low/mid/high quality tiers
- Local-first IndexedDB saves (with backup slot) + optional Supabase cloud sync (anonymous auth first)
- Optional shared daily city state from Supabase (weather, fuel, strike, delestage, headlines); offline play keeps the local simulation

## Stack

React 19 · TypeScript · Vite 7 · three.js + @react-three/fiber · zustand · i18next · Supabase
(sim core is headless and independent of rendering — see `src/sim/`)

## Quick start

```bash
npm install            # on Termux see SETUP.md for flags
npm run dev            # dev server at http://localhost:5173
npm run typecheck      # tsc --noEmit (includes tests)
npm test               # 250 tests (node --test)
npm run build          # production build → dist/
npm run size           # gzip size budgets (after build)
npm run db:verify      # verify live Supabase schema + RLS (optional, needs .env)
npm run reports -- list open  # review the content-report queue (local Management API token)
npm run deploy:cf      # build + deploy dist/ to Cloudflare Pages
npm run export:character # bake idle/walk/run/sit/phone clips → art/player_rig.glb
npm run review:packet  # generate the cultural review packet → art/cultural_review_packet.md
npm run world:inspect -- data/geodata/config/bastos.json    # inspect one area config
npm run world:build -- data/geodata/config/bastos.json      # rebuild one pack and upsert its registry entry
npm run world:validate # validate every registered pack, manifest, hashes and chunk payloads
npm run world:validate -- world/bastos/v1                   # validate one pack
npm run preview        # serve the production build
```

Cloud sync is optional: copy `.env.example` to `.env` and fill in your Supabase
URLs, then apply `supabase/migrations/0001_init.sql` and
`supabase/migrations/0002_world_state_cron.sql` in order. Without it the game
runs fully offline. See `SETUP.md` and `docs/BACKEND.md`.

CI runs typecheck, tests, build and size budgets on every push
(`.github/workflows/ci.yml`). Cloudflare Pages config lives in `wrangler.toml`
and `public/_headers`; Sentry/PostHog are optional and env-gated.

## Project layout

```
src/
  sim/          headless simulation: engine, state, needs, economy, relationships, rng
  data/         content packs: districts, items, activities, jobs, events, goals, places, NPCs
  world/        pure geographic world data layer: registry, UTM, chunks, terrain, roads, buildings, loader
  render/       three.js layer: world geometry, crowd, player rig, interiors, sky, geo renderer
  ui/           React phone, HUD, toasts, modals (travel, vendors, dialogue, njangi)
  state/        zustand bridge between sim and UI
  persistence/  IndexedDB saves + Supabase sync
  i18n/         English/French dictionaries
supabase/migrations/   Postgres schema + RLS
test/                  node --test suites for the sim core
scripts/vite.mjs       dev/build launcher with Android/Termux workarounds
```

Status board: `IMPLEMENTATION_CHECKLIST.md` (maps every PRD backlog item and
acceptance criterion to its state). Geographic world notes and attribution:
`docs/WORLD.md`; implementation suite: `docs/world-engine/`
(architecture, data sources, coordinates, manifest, chunks, roads, terrain,
buildings, offline packaging, licensing, budgets and progress).
PRD: `Yaounde_Life_Ultimate_PRD_v1.1.txt`.

## Notes

- All prices/wages in the game are indicative and live in data tables
- In-game currency has no real-world value; no real-money features are implemented yet
- Sensitive content is labeled in data (`design_interpretation`, `requires_local_validation`)
