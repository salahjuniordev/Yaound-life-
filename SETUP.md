# Setup

## Requirements

- Node 20+ (Node 26 recommended — tests use native TypeScript type stripping)
- npm 10+
- Optional: a Supabase project (free tier is fine for development)

## Install

Standard environments:

```bash
npm install
```

### Termux / Android

The project folder may live on the FUSE storage (`/storage/emulated/0/...`).
Two known constraints and how this repo handles them:

1. **npm cannot create symlinks on FUSE** → install with bin links disabled:
   ```bash
   npm_config_bin_links=false npm install --ignore-scripts --no-audit --no-fund
   ```
2. **The esbuild Go binary cannot execute from `/storage`** (and cannot resolve
   files there) → `scripts/vite.mjs` handles everything:
   - copies the esbuild binary to the app's internal temp dir and sets `ESBUILD_BINARY_PATH`
   - for `npm run dev`, mirrors the project to internal storage (`$TMPDIR/yaounde-life-dev`)
     and live-syncs your edits every ~1.5 s; run Vite there
   - for `npm run build` / `preview`, runs in place with a safe cwd

`@rollup/wasm-node` is used (via an npm alias for `rollup`) because the native
rollup binary has no Android arm64 build.

No other special steps are needed on Android: use `npm run dev`, `npm test`,
`npm run typecheck`, `npm run build` exactly as on desktop.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on 0.0.0.0:5173 (mirror mode under `/storage`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` (src, test, vite config) |
| `npm test` | Node test runner on `test/*.test.ts` (sim core) |

The test runner uses `scripts/test-register.mjs` (`registerHooks`) so the
extensionless imports used across `src/` resolve under plain Node.

## Supabase (optional cloud saves)

1. Create a project at supabase.com (region: Paris `eu-west-3` or Frankfurt —
   closest to Cameroon).
2. In the SQL editor, run `supabase/migrations/0001_init.sql` (or
   `supabase db push` with the CLI). It creates all tables and row-level
   security policies.
3. Enable **anonymous sign-ins**: Authentication → Providers → Anonymous.
4. For email upgrades, configure SMTP under Authentication → Email.
5. Copy the env file and fill in your keys (anonymous/public key only — never
   the service role key in the client):
   ```bash
   cp .env.example .env
   # VITE_SUPABASE_URL=https://xxxx.supabase.co
   # VITE_SUPABASE_ANON_KEY=eyJ...
   ```
6. Rebuild/restart. The Settings app in the Phone shows cloud status; saves
   push at day change and on tab close, and can be pushed/pulled manually.

Without env vars the game runs in offline mode: IndexedDB only, no network
calls, and the Supabase code is eliminated from the bundle.

## Deploy (web)

`npm run build` produces a static `dist/` (relative base path, `base: './'`),
so it works on Cloudflare Pages, Netlify, GitHub Pages or any static host.
Serve over HTTPS so the service worker and IndexedDB behave normally.

## Troubleshooting

- **`Unknown option '--root'` / config load errors on Termux** — make sure you
  run through `npm run dev|build` (wraps `scripts/vite.mjs`), not `vite` directly.
- **Dev server stale after `npm install`** — restart it (node_modules are synced
  to the mirror at startup only).
- **Tests fail to resolve `../src/...`** — ensure `NODE_OPTIONS` includes
  `--import ./scripts/test-register.mjs` (already in the npm script).
- **Cloud sync says "Supabase not configured"** — expected without `.env`;
  the game is fully playable offline.
