# Quorum

A small local web app that submits a Microsoft Form a configurable number of times, with a live-streaming, Discord-style console. *submit, again.*

> For open, anonymous forms whose owners explicitly invite repeat submissions.
> Unofficial tool — not affiliated with Microsoft.

![Quorum mid-run: chat-style log rows streaming in, a progress bar at 4 of 12, and ok/skipped tallies](docs/preview.png)

## The Idea

Some forms are meant to be stuffed — vote-for-the-office-dog polls, "say hi as
many times as you like" boards. Doing that by hand gets old after the third
submission. Quorum automates it, and it isn't hardcoded to any one form: each
form is a tiny profile file, and the engine and UI never change.

Four pieces, kept separate:

1. **Engine** (`submitter.py`) — drives chromium via Playwright: loads the form
   fresh each iteration, fills it, clicks Submit, waits for the thank-you text,
   sleeps a random polite delay, repeats. Emits structured events instead of
   printing, and checks a stop flag between iterations.
2. **Profiles** (`profiles/*.py`) — one file per form exposing `NAME`, `URL`,
   and `fill(page)`. The only thing you edit for a new form.
3. **Server** (`server.py`) — FastAPI; runs the engine in a worker thread and
   streams its events to the browser over Server-Sent Events.
4. **Front end** (`web/`) — one static page, hand-written CSS, vanilla JS.
   No framework, no build step.

## Install

Python 3.10+ required.

```powershell
pip install -r requirements.txt
playwright install chromium     # one-time browser download
```

## Run

```powershell
uvicorn server:app
```

Quorum runs as a local server — open the localhost URL uvicorn prints
(by default `http://127.0.0.1:8000`). On Windows you can also just
double-click `Quorum.bat`, which starts the server and opens the browser for
you; close its window to stop.

## Adding a Form

1. Record a walkthrough of the form once:

   ```powershell
   playwright codegen "https://forms.office.com/r/your-form-id"
   ```

2. Copy `profiles/example_form.py` to a new file, set `NAME` and `URL`, and
   paste the generated `page.*` lines into `fill(page)` — but **skip** the
   `page.goto(...)` line and the final Submit click (the engine does both).
3. Randomize at least one free-text answer with `random` (see the example) so
   submissions aren't byte-identical.
4. Hit the Reload button next to the profile dropdown.

Note: `.gitignore` keeps your personal profiles out of the repo by default
(they contain your form URLs); only the example template is tracked.

## Using the UI

- **Profile** — pick the form; Reload re-scans `profiles/`.
- **Submissions** — how many times to submit (default 10).
- **Delay min / max (s)** — each pause between submissions is drawn at random
  from this range (default 2–6 s).
- **Run hidden** — on runs chromium headless; off shows the browser window so
  you can watch it fill the form.
- **Start / Stop** — Start streams chat-style log rows with a live progress
  bar and ok/skipped tallies; Stop halts after the in-flight submission.

Dark mode is the default; the toggle in the left rail flips to light. Fully
keyboard navigable, and all motion respects `prefers-reduced-motion`.

## Rules of Engagement

- Automated submission is against Microsoft's Terms of Service, and high rates
  get rate-limited or temporarily blocked. **Keep volume reasonable** — the
  modest defaults are deliberate, and the random delays exist to be polite to
  the server, nothing more.
- A form set to one-response-per-person, or one with a CAPTCHA, will bounce.
  That usually means the owner didn't want multi-submit — respect that.
- Quorum deliberately includes no CAPTCHA solving, proxy rotation, or anything
  meant to defeat bot detection, and it never will.

## License

[MIT](LICENSE)
