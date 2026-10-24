# Requirements of the Data Analysis Web Application

How to read this document:

- **[REQUIREMENT]** is mandatory ("shall"). **[DECISION]** is an agreed design
  decision. **[CONSTRAINT]** limits the solution. **[INFO]** is background.
- **MVP**, **P2**, **P3** and **P4** are the delivery phases (see "Roadmap").
- Everything that needs a change of the database model, of existing server
  endpoints or of the game is NOT a requirement now. It is collected in
  "Future improvements" at the end. The only exception is P3 (feedback and
  admin), and only to the extent described in SC-08.

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

The web app can be used as a dashboard of the game and the database.
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

The web app also collects feedback about the game and about itself. Players and
psychologists fill in standard usability questionnaires (SUS, UEQ) and send
free-text messages. A separate admin account (the Admin role, ADM-01) sees the
usage numbers, the questionnaire results and the messages. In this document
"admin" always means this role, never a psychologist.

## Scope and constraints

- `[DECISION]` SC-01: Every psychologist can see every session, drawing and
  participant. There is no session ownership, no sharing and no reduced
  access level for now.
- `[CONSTRAINT]` SC-02: No modification of the existing database model. The
  existing SQLite tables and the MongoDB drawing document stay as they are.
  The only addition are the new tables of P3 (SC-08).
- `[CONSTRAINT]` SC-03: The server side analysis is a new, additive module in
  DatabaseServer that only reads the existing data. Existing routers and
  tables are not changed (apart from SC-08). Analysis results, thumbnails and
  reports are stored
  as files on the server, not in the databases.
- `[DECISION]` SC-04: The active session stays global (one per server) and
  works as it does now.
- `[DECISION]` SC-05: The UI is English. All texts come from translation
  resources, so Hungarian can be added later without code changes.
- `[DECISION]` SC-06: The real names of the participants are shown. There are
  no consent flags. Feedback is the exception (SC-09).
- `[DECISION]` SC-07: Decision support, not diagnosis. All metrics, indicators
  and AI outputs are descriptive or indicative, and are worded and labelled
  that way.
- `[DECISION]` SC-08: P3 (feedback and admin) may change the server in exactly
  these additive ways, and in no other: (a) new SQLite tables for the
  questionnaire submissions and the feedback messages, created with `CREATE
  TABLE IF NOT EXISTS` like `ActiveSession`; (b) a new value of the existing
  `Players.Role` integer column for the admin (no schema change); (c) a check
  in `/auth/signup` that rejects every role except Player and Psychologist;
  (d) request throttling for the whole API (SEC-02, SEC-03). The existing
  tables, the MongoDB document and the other routers stay as they are. The
  deployed server exe has to be rebuilt.
- `[DECISION]` SC-09: Feedback is pseudonymous for the admin. The database keeps
  the account ID with every submission (needed for the send limits and for the
  user's own history), but the admin API and screens never return the username,
  the real name or the account ID, only a stable pseudonym code (ADM-12). This
  is pseudonymisation on the application level: someone with direct access to
  the database can still identify the sender.
- `[INFO]` DatabaseServer/ is a separate repository. Its changes are done
  there, additively (see TEC-02).

## Users and access

- `[REQUIREMENT]` AUTH-01 (MVP): Login with the existing `/auth/login`
  endpoint (username and password, JWT).
- `[REQUIREMENT]` AUTH-02 (MVP): The token is kept in memory only, like in the
  game. A page reload needs a new login. An expired token (401) leads back to
  the login page. This can be revisited if it hurts usability.
- `[REQUIREMENT]` AUTH-03 (MVP): The web app has no sign-up page. Accounts are
  created in the game. The only exception is the admin account, which is
  created on the server (ADM-02).
- `[REQUIREMENT]` AUTH-04 (MVP, extended in P3): The UI depends on the role of
  the logged in user: psychologist -> full app, player -> player view, admin ->
  admin dashboard (P3, ADM-04). The UI only mirrors the rights, the server
  enforcement is authoritative.
- `[REQUIREMENT]` ACC-01 (MVP): Psychologists can read all sessions, drawings
  and participants.
- `[REQUIREMENT]` ACC-02 (MVP): Players can only see their own records (see
  "Player view"). They never see metrics, reports, AI output or other
  players' data. The feedback page (FBK-01) shows them their own submissions
  only.
- `[REQUIREMENT]` ACC-03 (P3): The admin sees the admin dashboard only (ADM-04):
  usage numbers, questionnaire results and feedback messages. The admin has no
  access to sessions, drawings, participants, metrics or reports, and the
  psychologist endpoints stay closed to the admin role (least privilege).
  Players and psychologists never see the submissions of other users.

## Web Application

- `[REQUIREMENT]` Psychologists shall be able to do analysis on session level
  and on drawing level.
- `[REQUIREMENT]` Players shall only see their records in the database like
  drawings, player info, in which session they draw, some session info, ...
- `[REQUIREMENT]` Players shall be able to rate the game, and psychologists the
  game and the web app, with standard questionnaires, and both shall be able
  to send feedback messages (see "Feedback, questionnaires and admin").
- `[REQUIREMENT]` The admin shall see the usage numbers, the questionnaire
  results and the feedback messages.

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

## Feedback, questionnaires and admin (P3)

- `[INFO]` Words used here: the **target** is what is rated (the game or the web
  app). An **instrument** is a standard questionnaire (SUS, UEQ) or the child
  version (SMILEY). A **submission** is one questionnaire or one feedback
  message that was sent.
- `[INFO]` P3 does not depend on the AI phase (P4) and comes before it. It is the
  only phase that may add to the server model (SC-08).

### Feedback page (players and psychologists)

- `[REQUIREMENT]` FBK-01 (P3): Players get a new "Feedback" page in the player
  view, psychologists the same page in the full app. It has three parts: the
  questionnaires, the message form (FBK-20) and the list of the user's own
  submissions (FBK-04).
- `[REQUIREMENT]` FBK-02 (P3): Targets. Players rate the game. Psychologists rate
  the game and the web app: every questionnaire is offered once per target.
- `[REQUIREMENT]` FBK-03 (P3): Everything can be filled in and sent several
  times, within the send limits (SEC-01). Every send is a new record, nothing
  is overwritten or merged, so changes over time stay visible.
- `[REQUIREMENT]` FBK-04 (P3): The user sees their own earlier submissions (time,
  type, target, and the text of messages), read only. Scores are not shown to
  the user. Editing or deleting is not possible for now (FUT-19).
- `[REQUIREMENT]` FBK-05 (P3): What was typed or chosen is not lost when a send
  fails (limit reached, network error). A rejected send shows a readable
  message, with the time to wait when a limit was hit (TEC-07). A successful
  send shows a confirmation and resets the form.

### Questionnaires

- `[REQUIREMENT]` FBK-10 (P3): SUS (System Usability Scale): the 10 standard
  items on a 5 point agreement scale, all items required. The word "system" is
  replaced by "game" or "web application" (an allowed adaptation). The score
  (0 to 100) is computed on the server with the standard formula from the raw
  answers.
- `[REQUIREMENT]` FBK-11 (P3): UEQ (User Experience Questionnaire): the 26
  standard items as 7 point scales between two opposite words, in the official
  order and polarity. The six scale means (attractiveness, perspicuity,
  efficiency, dependability, stimulation, novelty; range -3 to +3) are
  computed on the server from the raw answers. The short version UEQ-S (8
  items) is an open point.
- `[REQUIREMENT]` FBK-12 (P3): Answers are stored as item ID and number, never as
  text, so they do not depend on the language. The item texts come from the
  translation resources (SC-05); official translations of SUS and UEQ are used
  where they exist instead of own ones. Every submission records the
  instrument and its version. A change of wording or items is a new version.
- `[REQUIREMENT]` FBK-13 (P3): The terms of use of SUS and UEQ (and of the UEQ
  benchmark data, if used) are checked and recorded in the repo, like the
  model licences (AI-06).
- `[DECISION]` FBK-14 (P3): Children. Players aged 12 or younger (age from
  PlayerInfo, the same limit as the "children" preset in P2-01) get the SMILEY
  instrument instead of SUS and UEQ: a few simple questions about the game (for
  example "Did you like drawing?", "Was it easy?", "Would you play again?")
  answered with five faces. The questions are defined with the psychologists.
  Players of unknown age (the default is 0), older players and all
  psychologists get SUS and UEQ. The UI chooses the instrument from the user's
  PlayerInfo. The server stores the age band at the time of the submission (up
  to 12, 13 to 17, 18 and over, unknown), and results are always reported per
  instrument and per group, so child ratings never distort SUS and UEQ scores.

### Feedback messages

- `[REQUIREMENT]` FBK-20 (P3): The message form is a plain text box with a
  character counter and a send button. Optional: a category (problem, idea,
  praise, other). The target (game or web app) is chosen as in FBK-02. The text
  is limited (default 2000 characters, at least one non-blank character) and
  is plain text only.

### Admin dashboard

- `[REQUIREMENT]` ADM-01 (P3): The admin is a role of its own (value 2 of the
  role). It is not a psychologist and does not inherit psychologist rights. A
  new server side check (`require_admin`) guards the admin endpoints (ACC-03).
- `[REQUIREMENT]` ADM-02 (P3): The admin account is created on the server, never
  in the game or the web app: by a command run on the server PC. It can be run
  again without harm, takes username and password from its prompt or from
  environment variables, and prints or stores no secret.
- `[REQUIREMENT]` ADM-03 (P3): `/auth/signup` rejects every role except Player and
  Psychologist (SC-08c), so nobody can register as admin. The existing,
  accepted gap that anybody can register as psychologist is not part of this
  change.
- `[REQUIREMENT]` ADM-04 (P3): After login the admin sees the admin dashboard
  only, with two parts: Usage (ADM-05) and Feedback (ADM-06 to ADM-13).
- `[REQUIREMENT]` ADM-05 (P3): Usage numbers as tiles and one chart: registered
  accounts in total and per role (players, psychologists, admins); accounts
  that used the game, per role; new accounts per week; number of submissions
  (questionnaires and messages) and of unread messages. One aggregated server
  call, like DASH-03. What "used the game" means is an open point. Proposal: a
  player used it with at least one drawing, a psychologist with at least one
  sign-in (sessions have no owner, SC-01). The tooltip states the definition.
- `[REQUIREMENT]` ADM-06 (P3): The Feedback page has two tabs: Questionnaires and
  Messages. The numbers can be filtered by target, role, age band, instrument
  version and date range.
- `[REQUIREMENT]` ADM-07 (P3): SUS results: number of submissions, mean, standard
  deviation, median, minimum and maximum, a histogram, and the position
  against the usual reference points (for example 68 as the commonly used
  average), for each target and role. The mean of each item helps to find
  problems. Interpretation notes are worded as indications (SC-07).
- `[REQUIREMENT]` ADM-08 (P3): UEQ results: the six scale means with 95 %
  confidence intervals as a chart (not relying on colour alone, TEC-10), the
  item means, and the comparison with the UEQ benchmark when its terms allow
  it (FBK-13).
- `[REQUIREMENT]` ADM-09 (P3): SMILEY results: distribution of the faces per
  question. Shown separately from SUS and UEQ, never mixed with them.
- `[REQUIREMENT]` ADM-10 (P3): Counting rule. The same person can send many times
  (FBK-03), so a switch chooses between "latest submission per account" (the
  default, one vote per person) and "all submissions". A trend view shows the
  mean over time (per week or per instrument version). A group with fewer
  than 3 submissions shows "not enough data" (this also protects anonymity).
- `[REQUIREMENT]` ADM-11 (P3): Messages: a list, newest first, with pseudonym
  code, role, age band, target, category, time and text; filters (target,
  category, role, age band, date range, read or unread), text search and
  pagination. The admin can mark a message read or unread and delete it (with
  confirmation). New messages are unread.
- `[REQUIREMENT]` ADM-12 (P3): The pseudonym code is stable (the same account
  always has the same code) and is derived on the server with a key that
  survives restarts (not the ephemeral JWT secret). The admin never sees
  username, real name, account ID or IP address (SC-09).
- `[REQUIREMENT]` ADM-13 (P3): CSV export of the questionnaire answers and scores
  and of the messages (pseudonymised), in the two dialects of P2-05. Cells
  that start with `=`, `+`, `-` or `@` are neutralised against CSV injection.
  The UI warns that messages are free text and can contain personal data.

### Security shields

Threats and countermeasures at a glance:

| Threat | Countermeasure |
| ------ | -------------- |
| Flooding the feedback endpoints (DoS, spam, filling the database) | SEC-01, SEC-02, SEC-04, SEC-08 |
| Brute force on the login, especially of the admin account | SEC-02, SEC-03 |
| Stored XSS, injection and CSV injection through the free text | SEC-04, SEC-05, ADM-13 |
| Reading or sending as another user, becoming admin | SEC-06, ADM-02, ADM-03 |
| Double submission, replayed requests | SEC-07 |
| Leaking the identity of the sender or personal data | SC-09, ADM-12, SEC-11 |
| Sniffing and browser side attacks on the served app | SEC-09, SEC-10 |

- `[REQUIREMENT]` SEC-01 (P3): Send limits per account, enforced on the server (the
  UI only mirrors them: an attacker does not use the UI). Defaults, all
  configurable: a questionnaire (same instrument and target) at most once per
  hour; messages at most one per minute and 20 per day. An exceeded limit is
  answered with 429 and the time to wait (`Retry-After`), which the UI shows
  readably. The limits are counted from the stored submissions (so they
  survive a restart) and checked in the same transaction as the insert, so
  parallel requests cannot all pass.
- `[REQUIREMENT]` SEC-02 (P3): Request throttling for the whole API, per client IP
  and per account, also for the public endpoints (`/auth/login`,
  `/auth/signup`). Normal use of the game and of the analysis stays far below
  the limits, so game requests are not starved (TEC-05). Behind ngrok or
  another proxy the client IP is read from the forwarded header only when it
  comes from a configured, trusted proxy; otherwise all users share one IP and
  one bucket (open point).
- `[REQUIREMENT]` SEC-03 (P3): Login protection: repeated failed logins for the
  same username from the same IP are slowed down and then blocked for a while
  (default 5 failures, 15 minutes). The answer does not reveal whether the
  username exists. The block is per username and IP together, so an attacker
  cannot lock the admin out from everywhere.
- `[REQUIREMENT]` SEC-04 (P3): Strict input validation: a known instrument and
  version, exactly the items of that version, every answer inside its range, no
  unknown fields, a text length limit and a control character check (no null
  bytes), a request body size cap (default 16 KB) and a page size cap (default
  100). Scores sent by the client are ignored: the server computes them
  (FBK-10, FBK-11).
- `[REQUIREMENT]` SEC-05 (P3): Output safety: user text is only ever shown as
  plain text (React escaping, no `dangerouslySetInnerHTML`, no markdown or link
  rendering), SQL only with parameters, exports as in ADM-13, and any later
  HTML use as in REP-05.
- `[REQUIREMENT]` SEC-06 (P3): Object level authorization. The sender is taken
  from the token, never from the body or the path. A user reads only their own
  submissions, only the admin reads all of them, and only players and
  psychologists can send. No token gives 401, a wrong role 403. The tests cover
  the whole role and endpoint matrix (TEC-16).
- `[REQUIREMENT]` SEC-07 (P3): Idempotent send: every submission carries an ID
  generated by the client. A repeated ID (double click, network retry) gets the
  answer of the first send and creates no second record.
- `[REQUIREMENT]` SEC-08 (P3): Storage caps: a maximum number of stored
  submissions per account (default 500 messages and 200 questionnaires), so one
  account cannot fill the database. The admin can delete messages (ADM-11).
- `[REQUIREMENT]` SEC-09 (P3): When the server serves the built app (TEC-08):
  `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'` (or
  `X-Frame-Options`), `Referrer-Policy` and a Content-Security-Policy for the
  app. The generated reports are self-contained HTML (REP-02) and keep their
  own policy. CORS stays restricted to the configured origin.
- `[REQUIREMENT]` SEC-10 (P3): Outside localhost the connection is HTTPS (tunnel or
  reverse proxy), because passwords and tokens travel over it. No secret in
  the repository or the UI (TEC-09).
- `[REQUIREMENT]` SEC-11 (P3): Logs record failed logins, throttling hits and admin
  deletions, but never passwords, tokens or message texts.
- `[CONSTRAINT]` SEC-12 (P3): A rate limiting library would be a new dependency and
  is only added after confirmation. For one server process on the central PC a
  small in-process limiter is enough, and the per-account limits of SEC-01 live
  in the database anyway.

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

- `[REQUIREMENT]` AI-01 (P4): Only free models are used (open-source or
  open-weight, free for this use). No paid API and no cloud call. All
  inference runs on the server machine, so no drawing data leaves it.
- `[REQUIREMENT]` AI-02 (P4): Everything works on CPU, a GPU is optional. Heavy
  AI tasks run as background jobs with progress and cancel, and their results
  are cached like reports.
- `[REQUIREMENT]` AI-03 (P4): AI features can be switched off globally and one
  by one in the server configuration. The app is fully usable without them.
- `[REQUIREMENT]` AI-04 (P4): Every AI output is labelled "AI-generated" and
  shows the model name and version, the parameters, the prompt or vocabulary
  version, the confidence, and the evidence (for example which view or stroke
  group). Reports mark AI sections the same way.
- `[REQUIREMENT]` AI-05 (P4): AI output is decision support: indicators and
  suggestions for the psychologist. It does not diagnose and does not decide
  automatically.
- `[REQUIREMENT]` AI-06 (P4): The licence of every model is recorded and checked
  against the use in the study. Models are downloaded explicitly, never
  silently, and are listed (name, version, licence, status) on a settings
  page.
- `[REQUIREMENT]` AI-07 (P4): Before an AI function is shown by default, it is
  tried on a sample set of drawings together with a psychologist, and the
  agreement and failure modes are documented.

Functions:

- `[REQUIREMENT]` AI-10 (P4): Cohort analytics with classical machine learning
  (no pretrained model): atypical-drawing detection against the cohort (for
  example isolation forest or robust z-scores), "similar drawings" by nearest
  neighbours on the metric vector, and a 2D map of the session's drawings
  (PCA) coloured by participant or game type. Below a minimum number of
  drawings it says "not enough data".
- `[REQUIREMENT]` AI-11 (P4): Stroke clustering into object-like groups (spatial
  and temporal clustering, for example DBSCAN) with bounding box, colours and
  size per group, highlighted in the viewer. It is the basis of AI-12 and
  AI-13.
- `[REQUIREMENT]` AI-12 (P4): Zero-shot semantic labelling: canonical views
  (front, top, side, isometric) of the whole drawing and of every stroke group
  are rendered on the server and classified by a free CLIP-like image-text
  model against a configurable vocabulary (person, animal, house, tree, sun,
  water, ...). Output: top labels with confidence.
- `[REQUIREMENT]` AI-13 (P4): Description by a locally served open-weight
  vision-language model (for example through Ollama or llama.cpp) from the
  rendered views and a fixed, versioned prompt. The answer is structured JSON
  (depicted objects, scene, notable features, colour mood words), validated
  against a schema, with timeouts.
- `[REQUIREMENT]` AI-14 (P4): Fuzzy logic indicators: linguistic variables
  (low, medium, high) derived from metrics by cohort percentiles (fixed ranges
  as fallback), and a human-readable, versioned rule base file that
  psychologists can edit. Output: indicator, membership degree, the fired
  rules and the input values. Every rule has a documented rationale.
- `[REQUIREMENT]` AI-15 (P4): Session level insight aggregation, for example how
  often a semantic label recurs across the participants.
- `[REQUIREMENT]` AI-16 (P4, optional): A locally run language model writes a
  summary from the metrics and semantic labels. It is clearly marked, and the
  deterministic summary (REP-07) stays the default.
- `[REQUIREMENT]` AI-17 (P4, optional): Classification of 2D projections with a
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
- `[REQUIREMENT]` TEC-13 (P3): The server side is a new `feedback` module in
  DatabaseServer with its own routers: one for the users (instrument
  definitions, send a questionnaire, send a message, own submissions) and one
  for the admin (usage, results, messages, export). The new tables are created
  at start. Nothing else changes except what SC-08 lists. The game is not
  touched: it only checks for the Psychologist role, so an admin who logs in
  there is treated like a player (to verify, see the open points).
- `[REQUIREMENT]` TEC-14 (P3): Stored per questionnaire submission: ID, the ID
  generated by the client (unique), account ID, role and age band at the time,
  target, instrument and version, the answers (item ID to value), the computed
  scores and the creation time. Per message: ID, the ID generated by the
  client, account ID, role and age band, target, category, text, creation time
  and read flag. Indexes serve the limit queries (account, type, time). Raw
  answers are kept, so scores can be recomputed if the scoring changes.
- `[REQUIREMENT]` TEC-15 (P3): One versioned instrument definition on the server
  (items, scales, polarity, scoring) is used for both validation and scoring.
  The item texts live in the translations of the web app, keyed by item ID.
- `[REQUIREMENT]` TEC-16 (P3): Tests: scoring with known answers (SUS: all neutral
  answers give 50, the best possible answers 100; a UEQ vector with known scale
  means); the send limits (a second send inside the interval gives 429, after
  the interval it passes, parallel requests); the role and endpoint matrix
  including anonymous callers; signup with role 2 and with other invalid roles
  is rejected; validation (missing item, value out of range, oversized body);
  a repeated submission ID; and the key UI flows (fill in and send, limit
  message, admin sees the results).

## Decisions made while building Phase 2

- `[DECISION]` P2-01 (CMP-03): The group to compare with is chosen freely: the same
  game type and/or the same session, and an age range (from and to) with the presets
  children (up to 12), teenagers (13 to 17) and adults (18 and over). A group of fewer than
  3 drawings gets no percentiles. A percentile only says where a drawing lies among the
  others, never better or worse.
- `[DECISION]` P2-02 (MET-02, DRW-07): A pause is a gap of more than 5 seconds between
  strokes (adjustable on the timeline). A gap of more than 30 minutes is a break between
  sittings (the drawing was continued later): it is no pause, it is left out of the time
  span, it is cut down to 5 seconds on the time axis of the replay and the timeline, and
  the drawing gets the data quality flag "continued after a break". Found on real data: one
  drawing spanned 29 days.
- `[DECISION]` P2-03 (MUL-02, MUL-03, DRW-06): Defaults: strokes of different authors touch
  within 5 cm, a turn ends after a gap of 5 seconds, a heatmap cell is 5 cm. The touching
  distance, the pause limit and the cell size are adjustable in the screens.
- `[DECISION]` P2-04 (MET-02): The metric catalogue has three more metrics: pause time,
  menu opens and tool changes. Active drawing time counts the time during which at least
  one stroke was drawn, so simultaneous drawing of several authors counts once.
- `[DECISION]` P2-05 (EXP-01): The CSV exists in two dialects: R/SPSS (commas, decimal
  point, UTF-8) and Excel (semicolons, decimal comma, byte order mark). The UI warns that
  the file contains personal data.
- `[DECISION]` P2-06 (EXP-03): The 3D files hold the strokes as lines with their colours.
  The width is not exported. The game's z axis is negated (right-handed, Y up).
- `[DECISION]` P2-07: Numbers round half up on the server and in the app, so a report and
  the screen show the same number.
- `[DECISION]` P2-08 (TEC-02): A server build without the analysis module still works for
  what its older endpoints give (login, sessions, session management, participants, the 3D
  viewer). Everything else says "not implemented" instead of failing.
- `[INFO]` Not done, and not needed yet: background jobs (TEC-05, a report takes well under
  a second at the current data size) and server side pagination of the lists (TEC-06, SES-01).

## Roadmap

| Phase | Content |
| ----- | ------- |
| MVP | AUTH-01..04, ACC-01..02, DASH-01..03, SES-01..04, DRW-01..04, PLY-01..03, MET-01..08, REP-01..06, TEC-01..12 |
| P2 | SES-05 (session management), DRW-05..09 (replay, heatmaps, timeline, tracking, placed models), PAR-01, CMP-01..03, MUL-01..03, REP-07..08, EXP-01..04 |
| P3 | FBK-01..05, FBK-10..14, FBK-20 (feedback page, questionnaires, messages), ADM-01..13 (admin account and dashboard), SEC-01..12 (security shields), TEC-13..16 |
| P4 | AI-01..07 (principles), AI-10..17 (cohort ML, stroke clustering, semantic labelling, VLM description, fuzzy indicators, insight aggregation, optional LLM summary and sketch classifier) |

The MVP and Phase 2 are built. Phase 3 (feedback, questionnaires and admin) is planned and
does not depend on the AI phase, which is now Phase 4 (it was Phase 3 before). The Roadmap
page of the web app shows the state of every requirement, including the ones that are only
partly done. Its registry (`src/features/roadmap/registry.ts`) has to follow the
renumbering and get the new IDs.

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
- FUT-15 Replies to feedback: the admin answers a message and the user sees the
  answer (a conversation like an email), with a notification. Needs more
  tables, and a way to reply without revealing the sender (SC-09).
- FUT-16 Stronger password hashing (argon2 or bcrypt, upgraded on login). The
  passwords use SHA-256 with a salt, which was accepted before, but the admin
  account is more valuable. Needs a new dependency.
- FUT-17 Questionnaires and the smiley rating inside the VR game, right after
  drawing: where the experience happens and where children actually are. Needs
  a game change.
- FUT-18 Admin user management: list accounts, promote, disable, reset a
  password, delete an account with its data; an invite code or approval for
  psychologist sign-up (closes the accepted gap of ADM-03); an audit log of
  admin actions.
- FUT-19 Data rights and retention: users delete their own submissions, a
  retention period, deletion of the submissions together with the account (see
  FUT-07).
- FUT-20 Context for submissions: a rating attached to a session, a drawing, a
  report or an AI insight (see FUT-14), and a prompt to fill in a questionnaire
  after a number of sessions.
- FUT-21 More instruments: VR comfort and cybersickness (SSQ or VRSQ), presence
  (IPQ), a short usability scale for the web app (UMUX-Lite), workload
  (NASA-TLX), the Game Experience Questionnaire. Cybersickness matters most for
  children in VR.
- FUT-22 Admin triage and alerts: message status (new, in progress, done), tags,
  an unread badge, a notification (mail or push) for new messages, a weekly
  digest, export to an issue tracker.

## Open points to verify

- Does `placedModels` (or anything else) carry the figure position? (FUT-09) No drawing in
  the local database has placed models yet, so this could not be checked.
- Hardware of the server PC (CPU, GPU, RAM), which decides the AI model sizes.
- Serve the built app from the DatabaseServer (same origin) or separately.
- Licences of the chosen AI models.
- Charting library: the small SVG components covered Phase 2 (trends, timeline, heatmap
  projections, polar chart). Revisit it only if Phase 3 or 4 needs more (the
  questionnaire charts of Phase 3 are bars, intervals and histograms).
- The deployed server exe has to be rebuilt to get the analysis module.
- Phase 3: are the send limit defaults right (a questionnaire once per hour per
  instrument and target, messages one per minute and 20 per day)? (SEC-01)
- Phase 3: what is "used the game" for the usage numbers? The sign-in time is
  also set by logins to the web app, so it cannot tell the game from the web
  app, and sessions have no owner. A better answer needs a usage log (a new
  table). (ADM-05)
- Phase 3: the admin sees the admin dashboard only (ACC-03). Should the admin
  also be able to open the psychologist app?
- Phase 3: do players, and children in particular, use the web app at all? If
  not, the feedback page reaches few of them and FUT-17 (in the game) becomes
  important. Should players also rate the player view of the web app?
- Phase 3: UEQ in full (26 items) or the short UEQ-S (8 items)? A psychologist
  rates two targets, which is 72 items with SUS and UEQ, so they could be
  offered separately. (FBK-11)
- Phase 3: the SMILEY questions, the age limit of 12 and the handling of an
  unknown age. (FBK-14)
- Phase 3: official Hungarian versions of SUS and UEQ, their terms of use and
  the UEQ benchmark data. (FBK-12, FBK-13)
- Phase 3: how the trusted proxy (ngrok) is configured so that the real client
  IP is known. (SEC-02)
- Phase 3: where the pseudonym key is configured and how it is backed up, as a
  lost key changes all codes. (ADM-12)
- Phase 3: only the Psychologist check of the lobby in the game was verified for
  the new Admin value. The other uses of the role (login screen, database
  manager) are not checked, and neither is whether the admin may log in to the
  game at all. The `Role` enum of the game (`Role.cs`) mirrors the server and
  would optionally get the new value. (TEC-13)
- Phase 3: data protection for submissions of minors (consent of the study,
  retention). See FUT-07 and FUT-19.
