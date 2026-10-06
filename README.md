<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/readme/banner-light.svg">
    <img src=".github/readme/banner-dark.svg" alt="QUORUM" width="850">
  </picture>
</div>

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/card-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/readme/card-light.svg">
    <img src=".github/readme/card-dark.svg" alt="Quorum, a local web app that submits an open online form a set number of times with Playwright, with a live console streamed over SSE" width="850">
  </picture>
</div>

<p align="center">
  <a href="#hafizquorum-uvicorn-serverapp"><img src="https://img.shields.io/badge/python-3.10%2B-ff8ccf?style=for-the-badge&labelColor=161b22" alt="python: 3.10+"></a>
  <a href="#hafizquorum-man-quorum"><img src="https://img.shields.io/badge/console-live_over_sse-e3008c?style=for-the-badge&labelColor=161b22" alt="console: live over sse"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-mit-3fb950?style=for-the-badge&labelColor=161b22" alt="licence: mit"></a>
</p>

```text
hafiz@quorum:~$ cat ./about
a small local web app that submits an online form over and over for you,
with a live console so you can watch it go.

hafiz@quorum:~$ ls ./profiles
example_form.py
```

> Built for open, anonymous forms where the owner is fine with repeat submissions.
> Unofficial tool, not affiliated with any form provider.

### <samp>hafiz@quorum:~$ open ./console</samp>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/shots/run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset=".github/readme/shots/run-light.png">
    <img src=".github/readme/shots/run-dark.png" alt="Quorum mid-run: log rows streaming in, the progress bar at 5 of 12, ok 5 and skipped 0" width="850">
  </picture>
</p>

<table>
  <tr>
    <td width="50%"><samp>idle, ready when you are</samp></td>
    <td width="50%"><samp>run complete, 12 of 12 ok</samp></td>
  </tr>
  <tr>
    <td>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset=".github/readme/shots/idle-dark.png">
        <source media="(prefers-color-scheme: light)" srcset=".github/readme/shots/idle-light.png">
        <img src=".github/readme/shots/idle-dark.png" alt="The idle screen: run controls on the left and Quill, the mascot, with a hint on how to add a profile">
      </picture>
    </td>
    <td>
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset=".github/readme/shots/done-dark.png">
        <source media="(prefers-color-scheme: light)" srcset=".github/readme/shots/done-light.png">
        <img src=".github/readme/shots/done-dark.png" alt="A finished run: twelve confirmed submissions and a run complete row">
      </picture>
    </td>
  </tr>
</table>

<sub>Captured against a dummy form served on localhost. No real form was submitted to.</sub>

### <samp>hafiz@quorum:~$ whatis quorum</samp>

Some forms are meant to be spammed a little. Office polls, "drop a message" boards, that kind of thing. Submitting by hand gets old fast, so this automates it.

It's not hardcoded to one form. Each form gets a small profile file, and that's the only thing you ever edit:

- `submitter.py` is the engine. It opens chromium with Playwright, fills the form, clicks Submit, waits for the thank you text, sleeps a random delay, then repeats. It reports everything as events and checks a stop flag between rounds.
- `profiles/` holds one file per form: a `NAME`, a `URL`, and a `fill(page)` function.
- `server.py` is a small FastAPI app that runs the engine in a thread and streams its events to the page over SSE.
- `web/` is the UI. One static page, plain CSS and JS, no build step.

### <samp>hafiz@quorum:~$ uvicorn server:app</samp>

Needs Python 3.10+.

```powershell
pip install -r requirements.txt
playwright install chromium
uvicorn server:app
```

Then open the localhost URL it prints, usually `http://127.0.0.1:8000`. On Windows you can also double-click `Quorum.bat`, which starts the server and opens the browser for you. Close its window to stop.

### <samp>hafiz@quorum:~$ playwright codegen</samp>

Adding a form:

1. Record yourself filling the form once:

   ```powershell
   playwright codegen "https://your-form-host.example/your-form-id"
   ```

2. Copy `profiles/example_form.py`, set `NAME` and `URL`, and paste the recorded `page.*` lines into `fill(page)`. Skip the `page.goto(...)` line and the final Submit click, the engine handles those.
3. Randomize at least one text answer (the example shows how) so the submissions aren't all identical.
4. Hit Reload next to the profile dropdown.

Heads up: `.gitignore` ignores everything in `profiles/` except the example, so your own form URLs don't end up in the repo.

### <samp>hafiz@quorum:~$ man quorum</samp>

| control | what it does |
|:--|:--|
| **Profile** | Picks the form. Reload re-scans the folder. |
| **Submissions** | How many times to submit. Default 10. |
| **Delay min/max** | The random pause between submissions, default 2 to 6 seconds. |
| **Run hidden** | Runs the browser headless. Turn it off if you want to watch chromium fill the form, which is honestly the fun part. |
| **Start / Stop** | Stop finishes the submission it's on, then quits. |

Dark mode by default, toggle in the left rail. Works fine with keyboard only and respects reduced motion settings.

### <samp>hafiz@quorum:~$ cat ./etiquette</samp>

- Automating submissions is usually against a form host's terms of service, and if you go too fast you'll get rate-limited or temporarily blocked anyway. Keep the counts low and the delays generous.
- If a form is set to one response per person or has a CAPTCHA, it will bounce. That's the owner telling you they don't want this. Listen to them.
- There's no CAPTCHA solving, proxy rotation, or any anti-bot tricks in here, and there never will be.

### <samp>hafiz@quorum:~$ cat ./LICENSE</samp>

[MIT](LICENSE)

<sub>The banner and card are generated by <code>.github/readme/build.py</code> (standard library Python). Change a value at the top and run it again.</sub>
