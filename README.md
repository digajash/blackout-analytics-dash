# ■ BLACKOUT // Analytics

Free custom Blackout-branded dashboard for Suno metrics. **$0 spend.** Vite + React + TypeScript + Recharts + PapaParse.

Read-only against the SoT Google Sheet (`Blackout_Suno_Metrics_SoT`). Never writes. Never invents ticks.

## Quick start

```bash
cd /workspace/blackout-analytics-dash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ ready for any free static host
npm run preview      # serve production build locally
```

Hash routes: `#/war` · `#/hooks` · `#/songs` · `#/account`

## Data mode

Configured in `src/config.ts`:

```ts
export const DATA_MODE: DataMode = 'gviz'; // or 'local' | 'appsscript'
```

| Mode | Behavior |
|------|----------|
| **gviz** (default) | Fetch live CSV from Google Sheets gviz URLs. Needs Sheet shared **anyone-with-link → viewer** (or published). On 401/403/login wall, **auto-falls back to local** snapshots. |
| **local** | Always read `/public/data/{Songs,Hook_Registry,Wave_Ticks,Daily_Account}.csv`. Private. Works offline. |
| **appsscript** | Reserved for a free Apps Script JSON endpoint; currently falls back to local. |

### Flip modes

1. Open `src/config.ts`
2. Set `DATA_MODE` to `'gviz'` or `'local'`
3. Restart `npm run dev` (Vite HMR picks up config changes too)

### Current demo note

At build time (2026-10-06), the Sheet was **not** publicly link-viewable (gviz returned 401). Local CSV snapshots were exported via authenticated Google Sheets access into `public/data/`. The loader still prefers gviz and falls back automatically — so once Josh shares the Sheet as anyone-with-link viewer, live mode works with zero code change.

## Screens

1. **War Room** — Stack Call HOT/SAFE banner (from Hook_Registry flags only), Account Pulse, Active Hooks, Holds/Parked, Top Movers
2. **Hooks** — plays/hr vs T+ (Recharts, `connectNulls={false}`), side-by-side T+ table, Hook Registry cards
3. **Songs** — sortable leaderboard, growth curves on real time, hook-drop markers, song detail on click
4. **Account** — daily last-pull-of-day, Δ bars + cumulative line, followers step, pull log

## Aesthetic

Blackout dark tokens from the wires doc: `--bg #050505`, `--panel #0E0E0F`, `--blackout-red #E10600`, HOT pulse glow, SAFE green sparingly, Bebas Neue / JetBrains Mono / Inter.

## Free hosting later

`npm run build` → deploy `dist/` to GitHub Pages, Cloudflare Pages, or Netlify free tier. Hash routes need no server rewrites. Keep `DATA_MODE` local (bundle CSVs) or gviz (public Sheet).

## Ground rules (enforced)

- Read-only. Gaps = `—` / null. No smoothing.
- Times America/Chicago labeled **CT**.
- HOT/SAFE from Sheet flags only.
- Derived plays/hr tagged **calc**.
- OSS only. No paid APIs.

## Acceptance spot-checks (Sheet data)

- H-MUDDY-02 T+~8.5h: 742 plays, +358, 51/hr
- 10/5 pulls: plays 1522 → 1524 → 1631; followers 27 → 27 → 29

## Refresh local CSVs

Re-export the four tabs from the SoT Sheet into `public/data/*.csv` (or share the Sheet for gviz). Filenames must match tab names exactly.
