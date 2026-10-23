# Requirements of the Data Analysis Web Application

How to read this document:

- **[REQUIREMENT]** is mandatory ("shall"). **[DECISION]** is an agreed design
  decision. **[CONSTRAINT]** limits the solution. **[INFO]** is background.
- **MVP**, **P2** and **P3** are the delivery phases (see "Roadmap").
- Everything that needs a change of the database model, of existing server
  endpoints or of the game is NOT a requirement now. It is collected in
  "Future improvements" at the end.

## Frameworks and Libraries to use

- React with TypeScript (Vite build)
- Tailwind CSS (React Bootstrap is dropped: two CSS frameworks in one app
  conflict with each other)
- Axios and TanStack Query (server state, caching)
- three.js with @react-three/fiber (3D drawing viewer)
- A charting library (to be selected, with a colour-blind safe palette)
- react-i18next (translations)
- pnpm as package manager
- ...

The frameworks and libraries above are not mandatory to be used. During the
development they can be changed. A new dependency (JavaScript or Python) is
only added after it was confirmed.

## Goal

The web app can be used as an admin dashboard of the game and the database.
It should give an overview of the sessions with some statistics. The app
should give the opportunity to the psychologists to analyze the drawings
made in the sessions in session level and in drawing level as well.
The session analysis means that reports can be generated from the drawings
and the sessions. These are static or dynamic HTML pages those can be stored
on the server side and they can be reused to avoid regenerating them.

The analysis is done on server side by HTTP requests to the server
(DatabaseServer/) using python. During the analysis some AI models should
also be used for decision making.

Typical use: a psychologist creates a session for a situation or occasion,
the participants draw in the VR game (alone or together), and afterwards the
psychologist analyzes the results in the web app in a clean, understandable
way. The app supports the psychologist's judgement, it never replaces it.

## Scope and constraints

- `[DECISION]` SC-01: Every psychologist can see every session, drawing and
  participant. There is no session ownership, no sharing and no reduced
  access level for now.
- `[CONSTRAINT]` SC-02: No database model modification in this phase. The
  SQLite tables and the MongoDB drawing document stay as they are.
- `[CONSTRAINT]` SC-03: The server side analysis is a new, additive module in
  DatabaseServer that only reads the existing data. Existing routers and
  tables are not changed. Analysis results, thumbnails and reports are stored
  as files on the server, not in the databases.
- `[DECISION]` SC-04: The active session stays global (one per server) and
  works as it does now.
- `[DECISION]` SC-05: The UI is English. All texts come from translation
  resources, so Hungarian can be added later without code changes.
- `[DECISION]` SC-06: The real names of the participants are shown. There are
  no consent flags.
- `[DECISION]` SC-07: Decision support, not diagnosis. All metrics, indicators
  and AI outputs are descriptive or indicative, and are worded and labelled
  that way.
- `[INFO]` DatabaseServer/ is a separate repository. Its changes are done
  there, additively (see TEC-02).

## Users and access

- `[REQUIREMENT]` AUTH-01 (MVP): Login with the existing `/auth/login`
  endpoint (username and password, JWT).
- `[REQUIREMENT]` AUTH-02 (MVP): The token is kept in memory only, like in the
  game. A page reload needs a new login. An expired token (401) leads back to
  the login page. This can be revisited if it hurts usability.
- `[REQUIREMENT]` AUTH-03 (MVP): The web app has no sign-up page. Accounts are
  created in the game.
- `[REQUIREMENT]` AUTH-04 (MVP): The UI depends on the role of the logged in
  user: psychologist -> full app, player -> player view. The UI only mirrors
  the rights, the server enforcement (already existing) is authoritative.
- `[REQUIREMENT]` ACC-01 (MVP): Psychologists can read all sessions, drawings
  and participants.
- `[REQUIREMENT]` ACC-02 (MVP): Players can only see their own records (see
  "Player view"). They never see metrics, reports, AI output or other
  players' data.

## Web Application

- `[REQUIREMENT]` Psychologists shall be able to do analysis on session level
  and on drawing level.
- `[REQUIREMENT]` Players shall only see their records in the database like
  drawings, player info, in which session they draw, some session info, ...

### Dashboard

- `[REQUIREMENT]` DASH-01 (MVP): Overview tiles: number of sessions (open and
  closed), drawings and participants; the active session (name, start date);
  drawings per game type; drawings over time (per day or week).
- `[REQUIREMENT]` DASH-02 (MVP): Recent sessions and recent drawings with links.
- `[REQUIREMENT]` DASH-03 (MVP): The numbers come from one aggregated server
  side call, not from many single requests.

### Sessions

- `[REQUIREMENT]` SES-01 (MVP): Session list with name, description, start and
  end date, status (open, closed, active), flags (show boy/girl,
  multiplayer), number of drawings and participants. Search, filter (status,
  date range, game type), sort and pagination.
- `[REQUIREMENT]` SES-02 (MVP): Session detail: session info; participants
  (derived from the drawings) with real name, age, gender and dominant hand;
  drawing gallery with thumbnails, filterable by participant and game type.
- `[REQUIREMENT]` SES-03 (MVP): Session statistics: for every metric the
  distribution over the session's drawings (min, median, max) and a table per
  participant.
- `[REQUIREMENT]` SES-04 (MVP): Generate or open the session report from the
  session detail.
- `[REQUIREMENT]` SES-05 (P2): Session management with the existing session
  endpoints: create, edit, close, delete, activate. The server rules are
  shown as readable messages (the default session cannot be closed, a closed
  session cannot be activated, a session with drawings or an active room
  cannot be deleted). The active session is clearly marked.

### Drawings

- `[REQUIREMENT]` DRW-01 (MVP): 3D viewer with orbit, pan and zoom. Strokes use
  their colour, colour gradient and width. Ground grid and axes, reset view,
  preset views (front, top, side), fullscreen.
- `[REQUIREMENT]` DRW-02 (MVP): Viewer filters: per author, per hand, and show
  erased strokes (hidden by default). Selecting a stroke shows its length,
  duration, point count, hand and author.
- `[REQUIREMENT]` DRW-03 (MVP): The viewer works on decimated geometry from the
  analysis API with an adjustable detail level, and loads full resolution on
  demand. Drawings up to the storage limit (about 15 MB) stay usable.
- `[REQUIREMENT]` DRW-04 (MVP): Drawing detail page: drawing info (name, owner,
  session, game type, date, app version, device), metrics panel with
  definitions as tooltips, colour palette, data quality flags, link to the
  report.
- `[REQUIREMENT]` DRW-05 (P2): Replay: strokes appear in the order and timing
  they were drawn, with play/pause, speed and a scrubber. Optionally with the
  head and hand paths. Uses `utcMs` when available and the legacy timestamp
  otherwise (only time differences are meaningful there).
- `[REQUIREMENT]` DRW-06 (P2): 3D heatmap (voxel density) and top, front and
  side density projections, relative to the figure position when known.
- `[REQUIREMENT]` DRW-07 (P2): Behaviour timeline: strokes, erase and undo,
  menu open and close, mode, colour and width changes; idle periods.
- `[REQUIREMENT]` DRW-08 (P2): Tracked behaviour: head and hand trajectories,
  amount of movement, head direction summary, explored space. Tracking that
  was thinned out (`trackingDecimation` > 1) is flagged as approximate.
- `[REQUIREMENT]` DRW-09 (P2): Placed models (name, position) are shown in the
  viewer when the drawing has them.

### Participants

- `[REQUIREMENT]` PAR-01 (P2): Participant list and participant page with
  player info, drawings across all sessions, and metric trends over time.

### Comparison

- `[REQUIREMENT]` CMP-01 (P2): Two drawings side by side with synchronised
  cameras and a metric difference table.
- `[REQUIREMENT]` CMP-02 (P2): Same participant, same game type, over several
  sessions (baseline vs follow-up) with a trend chart per metric.
- `[REQUIREMENT]` CMP-03 (P2): Participant vs cohort: percentile of the
  participant among the drawings of a chosen set (a session, a game type, an
  age band) for each metric.

### Multiplayer analytics

The author of a stroke is taken from the stroke itself (`userID`), because the
collaborator list of a drawing is not reliably filled by the game.

- `[REQUIREMENT]` MUL-01 (P2): Contribution per author (strokes, ink length,
  drawing time) and a colour-by-author view.
- `[REQUIREMENT]` MUL-02 (P2): Spatial proximity and overlap between the
  strokes of different authors.
- `[REQUIREMENT]` MUL-03 (P2): Turn-taking timeline: who drew when, and the
  share of simultaneous drawing.

### Player view

- `[REQUIREMENT]` PLY-01 (MVP): Gallery of the player's own drawings with
  thumbnails, and the 3D viewer (same component as DRW-01).
- `[REQUIREMENT]` PLY-02 (MVP): The player's own info (name, gender, age,
  dominant hand), read only.
- `[REQUIREMENT]` PLY-03 (MVP): The sessions the player drew in, with the
  session info (name, description, dates).

## Drawing metrics

- `[REQUIREMENT]` MET-01 (MVP): Metrics are computed on the server from the
  stored drawing. Only drawn strokes count (status DRAWN). Erased strokes are
  analysed separately as behaviour.
- `[REQUIREMENT]` MET-02 (MVP): Metric catalogue. Every metric has an id, name,
  definition, unit and an interpretation note with its caveats. The same text
  is used in the documentation, the tooltips and the reports.
  - Space: bounding box size and volume (outlier trimmed), centroid, spread,
    height range
  - Counts: strokes drawn, strokes erased or undone, points
  - Length: total ink length, mean and median stroke length
  - Time: first-to-last stroke span, active drawing time, idle time
  - Motion: mean and peak speed, smoothness, jitter
  - Pressure: mean and variance of the trigger value (when recorded)
  - Density: points per length, occupied voxel ratio
  - Direction: dominant direction, direction distribution
  - Hand use: share of strokes and of ink length per hand
  - Colour and width: top colours by ink length, hue/saturation/brightness
    distribution, warm/cool ratio, number of distinct colours, width mean and
    variance
  - Tool behaviour (from events): menu opens, mode, colour and width changes,
    erase ratio
  - Distance to the child figure: only when its position is known
- `[REQUIREMENT]` MET-03 (MVP): Metric definitions of the old tool are reviewed
  before they are reused. Doubtful ones are redefined or dropped, for example
  "stroke complexity" (sum of squared point counts, mostly a length proxy),
  "smoothness" (1 / (1 + variance of acceleration), probably saturating
  because of the raw units) and "density" (the old tooltip says strokes per
  volume, the code computes points per length).
- `[REQUIREMENT]` MET-04 (MVP): Unit tests with synthetic strokes that have
  known answers.
- `[REQUIREMENT]` MET-05 (MVP): Old and new drawings both work: schema version 1
  (no `utcMs`, pressure, events or line stats) and 2, legacy timestamps, thinned
  tracking, unknown game types (shown as "Unknown (n)"). A metric that cannot
  be computed returns "not available" with the reason, never a fake value.
- `[REQUIREMENT]` MET-06 (MVP): Stored line stats (point count, length, bounds,
  duration) are used when present, so that the points need not be walked.
- `[REQUIREMENT]` MET-07 (MVP): Game types are labelled: Inner child, Word
  forest, Beach, Room, Bilateral drawing, Safe place.
- `[REQUIREMENT]` MET-08 (MVP): Data quality flags on drawings and in reports:
  old schema version, thinned tracking, very few strokes, all strokes erased,
  missing figure position, missing time data.

## Reports

- `[REQUIREMENT]` REP-01 (MVP): Server side generated reports from the analysis
  results: drawing report and session report.
- `[REQUIREMENT]` REP-02 (MVP): A report is one self-contained HTML file with
  no external resources (no CDN), with an interactive 3D view (embedded
  viewer and decimated geometry) and static snapshot images. It works offline
  and prints well (print stylesheet, PDF through the browser).
- `[REQUIREMENT]` REP-03 (MVP): Report content: session info, player info, game
  type, metrics grouped with their definitions, colour palette, charts, 3D
  view, data quality flags, AI section (when enabled, clearly labelled),
  generation time, analyzer version, and a note on how to interpret the
  numbers.
- `[REQUIREMENT]` REP-04 (MVP): Reuse: reports are stored in a server file
  store (configurable directory). The cache key is the drawing(s), the
  content fingerprint (TEC-04), the analyzer version and the report template
  version. A stored report is reused instead of regenerated. The user can
  regenerate it, sees when it is stale (the data changed), and can list,
  open, download and delete reports.
- `[REQUIREMENT]` REP-05 (MVP): All user-provided text in generated HTML
  (names, session names, descriptions) is HTML-escaped.
- `[REQUIREMENT]` REP-06 (MVP): Reports are available for psychologists only.
- `[REQUIREMENT]` REP-07 (P2): Template-based narrative summary of the metrics
  (deterministic text, no AI).
- `[REQUIREMENT]` REP-08 (P2): Participant history report (trends,
  comparisons).

## Export

- `[REQUIREMENT]` EXP-01 (P2): CSV export of the metrics of a session (one row
  per drawing, with participant info) for SPSS or R. The UI warns that the
  file contains personal data.
- `[REQUIREMENT]` EXP-02 (P2): Download the raw drawing as JSON.
- `[REQUIREMENT]` EXP-03 (P2): Export the 3D geometry (glTF, OBJ or PLY).
- `[REQUIREMENT]` EXP-04 (P2): PNG snapshot of the current viewer camera.

## AI based data analysis and decision support

- `[INFO]` There is an old version of the analysis tool
  (ReusableAssets\VRDrawing3D_DataAnalysis) which was used for the old version
  of the game that can be reused in pieces if necessary.
- `[INFO]` What is worth reusing: the metric ideas (after MET-03), the tooltip
  explanations, and the report layout (session info, player info, metrics,
  3D view). What is not: its field names (it reads `sessionId`, `userId` and
  hand `"left"`, the game stores `sessionID`, `owner` and hand -1/1), the
  one-trace-per-segment Plotly figure (too heavy), the raw string
  interpolation into HTML, and the CDN dependency.

Principles:

- `[REQUIREMENT]` AI-01 (P3): Only free models are used (open-source or
  open-weight, free for this use). No paid API and no cloud call. All
  inference runs on the server machine, so no drawing data leaves it.
- `[REQUIREMENT]` AI-02 (P3): Everything works on CPU, a GPU is optional. Heavy
  AI tasks run as background jobs with progress and cancel, and their results
  are cached like reports.
- `[REQUIREMENT]` AI-03 (P3): AI features can be switched off globally and one
  by one in the server configuration. The app is fully usable without them.
- `[REQUIREMENT]` AI-04 (P3): Every AI output is labelled "AI-generated" and
  shows the model name and version, the parameters, the prompt or vocabulary
  version, the confidence, and the evidence (for example which view or stroke
  group). Reports mark AI sections the same way.
- `[REQUIREMENT]` AI-05 (P3): AI output is decision support: indicators and
  suggestions for the psychologist. It does not diagnose and does not decide
  automatically.
- `[REQUIREMENT]` AI-06 (P3): The licence of every model is recorded and checked
  against the use in the study. Models are downloaded explicitly, never
  silently, and are listed (name, version, licence, status) on a settings
  page.
- `[REQUIREMENT]` AI-07 (P3): Before an AI function is shown by default, it is
  tried on a sample set of drawings together with a psychologist, and the
  agreement and failure modes are documented.

Functions:

- `[REQUIREMENT]` AI-10 (P3): Cohort analytics with classical machine learning
  (no pretrained model): atypical-drawing detection against the cohort (for
  example isolation forest or robust z-scores), "similar drawings" by nearest
  neighbours on the metric vector, and a 2D map of the session's drawings
  (PCA) coloured by participant or game type. Below a minimum number of
  drawings it says "not enough data".
- `[REQUIREMENT]` AI-11 (P3): Stroke clustering into object-like groups (spatial
  and temporal clustering, for example DBSCAN) with bounding box, colours and
  size per group, highlighted in the viewer. It is the basis of AI-12 and
  AI-13.
- `[REQUIREMENT]` AI-12 (P3): Zero-shot semantic labelling: canonical views
  (front, top, side, isometric) of the whole drawing and of every stroke group
  are rendered on the server and classified by a free CLIP-like image-text
  model against a configurable vocabulary (person, animal, house, tree, sun,
  water, ...). Output: top labels with confidence.
- `[REQUIREMENT]` AI-13 (P3): Description by a locally served open-weight
  vision-language model (for example through Ollama or llama.cpp) from the
  rendered views and a fixed, versioned prompt. The answer is structured JSON
  (depicted objects, scene, notable features, colour mood words), validated
  against a schema, with timeouts.
- `[REQUIREMENT]` AI-14 (P3): Fuzzy logic indicators: linguistic variables
  (low, medium, high) derived from metrics by cohort percentiles (fixed ranges
  as fallback), and a human-readable, versioned rule base file that
  psychologists can edit. Output: indicator, membership degree, the fired
  rules and the input values. Every rule has a documented rationale.
- `[REQUIREMENT]` AI-15 (P3): Session level insight aggregation, for example how
  often a semantic label recurs across the participants.
- `[REQUIREMENT]` AI-16 (P3, optional): A locally run language model writes a
  summary from the metrics and semantic labels. It is clearly marked, and the
  deterministic summary (REP-07) stays the default.
- `[REQUIREMENT]` AI-17 (P3, optional): Classification of 2D projections with a
  free sketch-trained model as a lightweight alternative to AI-12 and AI-13,
  adopted only if it is better on the sample set (AI-07).
- `[INFO]` Model candidates to evaluate (final choice by licence, quality on the
  sample set and the hardware of the server PC): OpenCLIP or SigLIP for
  AI-12, a small open-weight vision-language model such as LLaVA, Moondream
  or Qwen-VL for AI-13, scikit-learn for AI-10 and AI-11.

## Technical requirements

- `[REQUIREMENT]` TEC-01 (MVP): The web app is a single-page application in
  DataAnalysis/ (React, TypeScript, Vite, Tailwind).
- `[REQUIREMENT]` TEC-02 (MVP): The server side is a new `analysis` module in
  DatabaseServer with its own router. Its endpoints need a psychologist
  token. The exceptions are the geometry and thumbnail endpoints of a
  drawing, which are also open to the owner of that drawing (player view).
  The module only reads the existing data. Existing routers, tables and the
  MongoDB document are not changed (SC-02, SC-03).
- `[REQUIREMENT]` TEC-03 (MVP): One file store (configurable directory) for
  results, thumbnails and reports. File names are derived from validated IDs
  and hashes only (no path traversal).
- `[REQUIREMENT]` TEC-04 (MVP): Cache invalidation without a revision field: a
  content fingerprint is computed from the stored drawing (for example line
  IDs, point counts, statuses, last point times). It has to be cheap, so the
  whole 15 MB document is not hashed on every request.
- `[REQUIREMENT]` TEC-05 (MVP): Heavy tasks (report generation, later AI) run as
  background jobs with a status endpoint and a limit of concurrent jobs. The
  game uses the same server, so analysis must not starve game requests.
- `[REQUIREMENT]` TEC-06 (MVP): Lists are paginated. Geometry is simplified on
  the server (for example Ramer-Douglas-Peucker with a tolerance parameter).
- `[REQUIREMENT]` TEC-07 (MVP): Server errors are shown to the user as readable
  messages. Every view has loading, empty and error states.
- `[REQUIREMENT]` TEC-08 (MVP): The server must allow the origin of the web app
  (CORS setting, currently only localhost and port 3000), or the built app is
  served from the same origin as the API. Decided at deployment time. This is
  a configuration, not a database change.
- `[REQUIREMENT]` TEC-09 (MVP): No secrets in the repository or the UI. Path and
  query IDs are validated on the server.
- `[REQUIREMENT]` TEC-10 (MVP): Desktop first, usable on a tablet. Sufficient
  contrast, and charts do not rely on colour alone.
- `[REQUIREMENT]` TEC-11 (MVP): Tests: metric unit tests (MET-04), API tests with
  fixture drawings (schema 1 and 2, multiplayer, thinned tracking) and tests
  of the key UI flows (login, session list, viewer loads).
- `[REQUIREMENT]` TEC-12 (MVP): The metric catalogue is documented in the repo,
  and the API is documented through the FastAPI `/docs` page.

## Roadmap

| Phase | Content |
| ----- | ------- |
| MVP | AUTH-01..04, ACC-01..02, DASH-01..03, SES-01..04, DRW-01..04, PLY-01..03, MET-01..08, REP-01..06, TEC-01..12 |
| P2 | SES-05 (session management), DRW-05..09 (replay, heatmaps, timeline, tracking, placed models), PAR-01, CMP-01..03, MUL-01..03, REP-07..08, EXP-01..04 |
| P3 | AI-01..07 (principles), AI-10..17 (cohort ML, stroke clustering, semantic labelling, VLM description, fuzzy indicators, insight aggregation, optional LLM summary and sketch classifier) |

## Future improvements (not requirements now)

These need a change of the database model, of existing server endpoints or of
the game, so they are out of scope for now (SC-02, SC-03). They are collected
here for a later update.

- FUT-01 Session ownership and access levels. Sessions get an owner, and a
  session can be shared. Levels: Owner (full), Shared (read, analyze), Browse
  (other psychologists: aggregates and anonymised participants, no personal
  data, no export). Needs a `CreatedBy` column on `Sessions` and a
  `SessionAccess` table (a separate table, because `CREATE TABLE IF NOT
  EXISTS` cannot add a column to an existing database, as with
  `ActiveSession`), and one server side `access_level(session, caller)` check
  used by every endpoint. Existing sessions would need an owner policy.
- FUT-02 Parallel psychologists. The active session is global, so a second
  psychologist activating a session redirects everybody's new drawings.
  Options: an active session per psychologist, or join codes.
- FUT-03 Drawing revision (`updatedAt`) and a creation time in `DrawingMeta`
  (today the date is only in the MongoDB metadata). Replaces the content
  fingerprint (TEC-04) and allows sorting and filtering in SQL.
- FUT-04 Persistent store for analysis results and reports (a MongoDB
  collection such as `analysis_results`, and a job table) instead of the file
  store.
- FUT-05 Psychologist notes, tags and annotations (also with 3D viewpoints) on
  sessions and drawings. Needs new tables.
- FUT-06 Session roster (invited participants, who has not drawn yet) and
  session templates or protocols with instructions for an occasion.
- FUT-07 Privacy extras: pseudonym codes and age bands, anonymised research
  export, access audit log, consent and retention flags.
- FUT-08 Dashboard-friendly changes of the existing API: paginated and
  filtered list endpoints, and a light drawing endpoint without tracking.
  Until then the analysis API provides these.
- FUT-09 Game and server: store the figure (child) position in the drawing
  metadata. The save endpoint currently stores `sadChildCoordinates` as
  `None`, so the distance-to-child metric has no data for those drawings. To
  verify: whether `placedModels` already carries the position.
- FUT-10 Game: in-game camera snapshots at save time (canonical views with
  scene context, time-lapse frames), stored outside the MongoDB document
  because of its size limit (for example GridFS or files). Enables thumbnails
  with the scene and later object detection.
- FUT-11 Object detection (YOLO). A pretrained YOLO does not recognise 3D
  scribbles, and what the player looked at or drew near can be computed
  geometrically from head pose and known object positions, without a model.
  It becomes worthwhile with FUT-10 images and fine-tuning on sketches, or an
  open-vocabulary detector evaluated on them.
- FUT-12 Live session monitor: active rooms and connected participants,
  spectator mode. Needs a list-rooms endpoint and presence information.
- FUT-13 Hungarian UI (SC-05 prepares it).
- FUT-14 Saved views and user preferences, and psychologist feedback on AI
  insights to improve the rules and the model choice.

## Open points to verify

- Does `placedModels` (or anything else) carry the figure position? (FUT-09)
- Hardware of the server PC (CPU, GPU, RAM), which decides the AI model sizes.
- Serve the built app from the DatabaseServer (same origin) or separately.
- Licences of the chosen AI models.
- Final choice of the charting library.
