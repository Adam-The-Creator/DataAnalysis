# DataAnalysis

Data Analysis Web Application for VRMultiplayer.

Psychologists use it to see the sessions and drawings made in the VR art therapy game, and to analyze them on
session level and on drawing level. Players see their own records. What it has to do, and in which phase, is
written in [requirements.md](requirements.md). The **Roadmap** page of the app shows where every requirement
stands.

## Run it

pnpm is the package manager. If `pnpm` is not installed, use it through corepack (`corepack pnpm ...`).

```bash
cd DataAnalysis
pnpm install
pnpm dev          # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm preview`, `pnpm typecheck`, `pnpm lint`.

### Demo data or live server

The login page switches between two data sources (the default of the development server comes from `.env.example`, copy
it to `.env.local`):

| Mode | What it is |
| ---- | ---------- |
| **Demo data** | Generated sample sessions and drawings (with tracking, events, placed models, several sessions over time), and a stand-in for the analysis module. No server needed. Use the two buttons to enter as a psychologist or as a player. |
| **Live server** | The real DatabaseServer (default `http://127.0.0.1:8000`, can be changed on the login page). Log in with a psychologist or player account of the game. |

The dev server uses port 3000 because that is the origin the DatabaseServer already allows (its `config.py`
CORS list).

### Release build: served by the DatabaseServer

`pnpm build` makes the release build. It is built for the address `/app/` (`vite.config.ts`, `base`), and the
DatabaseServer serves it there: set `WEBAPP_PATH` in its `config.py` (or the environment variable of the same name) to
the folder of the build, and the app is at `http://<server>/app/` (a browser sent to the root of the server is passed on
to it). The psychologists then use the app at the same address as the game, for example the public ngrok URL, without any
installation and without CORS. The release build talks to the server it came from, so the login page shows the server
address read only; `VITE_API_BASE_URL` only matters for `pnpm dev`. The server sends a Content-Security-Policy with the
app (see requirement REL-01 in [requirements.md](requirements.md)). `pnpm preview` serves the build under `/app/` too,
but without a server behind it only the demo data works.

A `dist` folder built **before** the app was made for `/app/` (or by anything else that builds for `/`) asks the browser for
`/assets/...` and `/favicon.svg`, which the server answers with 404: the page stays blank. Build again (`pnpm build`; use
`VITE_API_MODE=live` to have the login page start on *Live server*). The server prints a warning at start-up when the
folder it serves was not built for `/app/`.

For a whole installer (server, launcher, this app, AI models) see `Tools/` in the project root: its `Build-Release.ps1`
builds this app, and the launcher tells the server where it is.

### What the live server needs

The analysis (metrics, statistics, replay data, timeline, heatmap, comparison, reports, export, ...) is done by the
**analysis module of the DatabaseServer** (`DatabaseServer/analysis`, see its README). A server build that has it
makes everything work. A server **without** it (an older build, for example a deployed exe that has not been rebuilt)
still works for what the older endpoints can give: login, sessions, session management, participants and the 3D
viewer (from the whole stored drawing). Everything else shows a "Not implemented yet" panel instead of failing.

## What it does

- **Dashboard and sessions:** numbers, charts, filters; create, edit, activate, close and delete sessions, with the
  server's own messages when it refuses something.
- **Drawing page:** 3D viewer with a detail level, filters, colour by author, replay, and layers for the heatmap,
  the tracked head and hand movement and the placed models. Below it: behaviour timeline, authors and collaboration,
  tracked movement, ink density, metrics with a template-based summary, data quality notes.
- **Participants:** history across all sessions and trends of any metric.
- **Compare:** two drawings side by side (cameras together, table of differences), a participant over time
  (baseline against follow-up), and a drawing against a group (same game type, same session, any age range).
- **Reports and export:** self-contained HTML reports of a drawing, a session or a participant (stored on the server and
  reused while nothing changed), CSV of a session (R/SPSS or Excel), raw JSON, glTF/OBJ/PLY, PNG snapshot.
- **Player view:** a player's own info, sessions and drawings, with the viewer and the replay.

## Structure

```text
src/
  api/             The only code that talks to a backend
    contract.ts      Interface of everything the UI needs
    live.ts          Client of the DatabaseServer, with fallbacks for a server without the analysis module
    mock/            Demo client: generated world, stand-ins of the server's analyses, report builders
    hooks.ts         TanStack Query hooks, the only place where screens fetch data
    types.ts         Data shapes (server models + analysis contract)
  auth/            Login state, in-memory token, route guards by role
  components/      layout (shell), ui (cards, dialogs, states, ...), charts (small SVG components)
  features/        One folder per screen: dashboard, sessions, drawings (3D viewer, panels), participants,
                   compare, reports, export, player, roadmap (+ the requirement registry)
  lib/             Pure helpers: strokes, time axis, metric catalogue, formatting, geometry, SVG snapshots
  i18n/            Translations: every user-visible text, typed keys (English now, Hungarian later)
```

Key ideas:

- **One contract, two backends.** Screens only use `getApi()` through the hooks. Switching between demo and live
  changes nothing in the screens.
- **The server is the reference.** The demo mode's stand-ins (`api/mock/analysisEngine.ts`, `analytics.ts`,
  `exports.ts`) are ports of the server module and are kept in step with it. They were compared with it on the same
  drawings, with identical results.
- **Gaps stay visible.** A feature the server cannot answer shows a panel that says so, never an empty page or a fake
  value. A metric that cannot be computed shows "n/a" with the reason.
- **Time.** Every time in an analysis answer is on the drawing's time axis. A break of more than 30 minutes between two
  strokes (the drawing was continued later) is cut down to 5 seconds there.
- **The token lives in memory only.** A page reload needs a new login (requirement AUTH-02).
- **No database model changes** are needed or assumed (requirement SC-02). Ideas that would need them are in the
  "Future improvements" section of requirements.md.

## Tests

The server's analysis module has a unit test suite in the DatabaseServer repository
(`python -m unittest discover -s tests -t .`). This repository has no test runner yet (requirement TEC-11, partly
done): the screens were checked with throw-away scripts that run the whole app in jsdom against the demo data, against a
stub of an older server and against the real server. Their gaps: no real WebGL, so the 3D rendering itself, the camera
sync and the PNG snapshot are only checked as far as their math and objects go.

## Not done yet

Everything AI related (phase 3), background jobs for report generation, server side pagination of the lists, and a test
runner in this repository. See the Roadmap page.
