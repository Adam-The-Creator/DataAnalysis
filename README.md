# DataAnalysis

Data Analysis Web Application for VRMultiplayer.

Psychologists use it to see the sessions and drawings made in the VR art therapy game, and to analyze them on
session level and on drawing level. Players see their own records. What it has to do, and in which phase, is
written in [requirements.md](requirements.md). The **Roadmap** page of the app shows where every requirement
stands in the current prototype.

## Run it

pnpm is the package manager. If `pnpm` is not installed, use it through corepack (`corepack pnpm ...`).

```bash
cd DataAnalysis
pnpm install
pnpm dev          # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm preview`, `pnpm typecheck`, `pnpm lint`.

### Demo data or live server

The login page switches between two data sources (the default comes from `.env.example`, copy it to `.env.local`):

| Mode | What it is |
| ---- | ---------- |
| **Demo data** | Generated sample sessions and drawings, and a stand-in for the analysis module. No server needed. Use the two buttons to enter as a psychologist or as a player. |
| **Live server** | The real DatabaseServer (default `http://127.0.0.1:8000`, can be changed on the login page). Log in with a psychologist or player account of the game. |

The dev server uses port 3000 because that is the origin the DatabaseServer already allows (its `config.py`
CORS list). Nothing has to be changed on the server for the live mode.

### What works against the live server today

The server side analysis module (requirements TEC-02) does not exist yet. In live mode everything that
only needs the existing endpoints works: login, dashboard numbers, sessions, participants, the 3D viewer, the
player view. Everything that needs the analysis module (metrics, session statistics, thumbnails, reports,
drawings over time, recent drawings) shows a **"Not implemented yet"** panel that names the missing requirement.
Demo mode shows how those screens will look.

## Structure

```text
src/
  api/             The only code that talks to a backend
    contract.ts      Interface of everything the UI needs (the analysis part is the future server API)
    live.ts          Client of the DatabaseServer, throws NotImplementedError where the server cannot answer
    mock/            Demo client: generated world, stand-in analysis engine and report builder
    hooks.ts         TanStack Query hooks, the only place where screens fetch data
    types.ts         Data shapes (server models + analysis contract)
  auth/            Login state, in-memory token, route guards by role
  components/      layout (shell), ui (cards, states, ...), charts (small SVG components)
  features/        One folder per screen: dashboard, sessions, drawings (3D viewer), reports,
                   participants, compare, player, roadmap (+ the requirement registry)
  lib/             Pure helpers: strokes, metric catalogue, formatting, geometry, SVG snapshots
  i18n/            Translations: every user-visible text, typed keys (English now, Hungarian later)
```

Key ideas:

- **One contract, two backends.** Screens only use `getApi()` through the hooks. Switching between demo and live
  changes nothing in the screens. When the server's analysis module is built, only `live.ts` changes.
- **Gaps stay visible.** A missing server feature throws `NotImplementedError`, and the UI shows a panel with the
  requirement ids instead of an empty page or a fake value.
- **Temporary shortcuts are marked** with `TEMPORARY` in the code (for example the dashboard overview that is
  composed on the client from several requests, which the analysis API will return in one call).
- **The token lives in memory only.** A page reload needs a new login (requirement AUTH-02).
- **No database model changes** are needed or assumed (requirement SC-02). Ideas that would need them are in the
  "Future improvements" section of requirements.md.

## Not done yet

See the Roadmap page. The main gaps: the server side analysis module itself, tests, replay and heatmaps, comparison,
session management, export, and everything AI related (phase 3).
