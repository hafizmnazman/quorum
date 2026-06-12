"""Quorum engine: load a form profile, fill + submit it N times, emit events.

The engine knows nothing about HTTP or the UI. It receives an `emit` callback
for structured events and a `should_stop` callable checked between iterations.
"""

from __future__ import annotations

import importlib.util
import random
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from playwright.sync_api import sync_playwright

PROFILES_DIR = Path(__file__).parent / "profiles"

CONFIRM_PATTERN = re.compile(r"thank|submitted|recorded|your response", re.I)
CONFIRM_TIMEOUT_MS = 8_000


@dataclass
class Profile:
    name: str
    url: str
    fill: Callable
    path: Path


def _load_module(path: Path):
    spec = importlib.util.spec_from_file_location(f"quorum_profile_{path.stem}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def list_profiles() -> list[Profile]:
    """Scan profiles/ for valid profile modules, skipping files starting with _."""
    profiles = []
    if not PROFILES_DIR.is_dir():
        return profiles
    for path in sorted(PROFILES_DIR.glob("*.py")):
        if path.name.startswith("_"):
            continue
        try:
            module = _load_module(path)
            profiles.append(
                Profile(name=module.NAME, url=module.URL, fill=module.fill, path=path)
            )
        except Exception:
            # A broken profile file shouldn't take down the listing.
            continue
    return profiles


def load_profile(name: str) -> Profile:
    for profile in list_profiles():
        if profile.name == name:
            return profile
    raise LookupError(f"No profile named {name!r} in {PROFILES_DIR}")


def run(
    profile: Profile,
    count: int,
    headless: bool,
    min_delay: float,
    max_delay: float,
    emit: Callable[[dict], None],
    should_stop: Callable[[], bool],
) -> int:
    """Submit `profile` `count` times. Returns the number of confirmed submissions."""
    ok = 0
    skipped = 0
    done = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context()
        page = context.new_page()
        try:
            for i in range(1, count + 1):
                if should_stop():
                    emit({
                        "type": "log", "i": i, "total": count, "status": "error",
                        "msg": "Stopped by user.",
                    })
                    break

                status, msg = "ok", "Submitted and confirmed."
                try:
                    page.goto(profile.url, wait_until="domcontentloaded")
                    profile.fill(page)
                    _click_submit(page)
                    if _confirmed(page):
                        ok += 1
                    else:
                        status = "timeout"
                        msg = "Submitted, but no confirmation appeared (continuing)."
                        skipped += 1
                except Exception as exc:
                    status = "error"
                    msg = f"{type(exc).__name__}: {_first_line(exc)}"
                    skipped += 1

                done = i
                emit({"type": "log", "i": i, "total": count, "status": status, "msg": msg})
                emit({
                    "type": "progress",
                    "done": done, "total": count, "ok": ok, "skipped": skipped,
                })

                if i < count and not should_stop():
                    time.sleep(random.uniform(min_delay, max_delay))
        finally:
            context.close()
            browser.close()

    emit({"type": "done", "ok": ok, "total": count})
    return ok


def _click_submit(page) -> None:
    button = page.get_by_role("button", name=re.compile("submit", re.I))
    if button.count() > 0:
        button.first.click()
        return
    fallback = page.locator("button:has-text('Submit')")
    if fallback.count() > 0:
        fallback.first.click()
        return
    raise RuntimeError("Could not find a Submit button on the page.")


def _confirmed(page) -> bool:
    try:
        page.get_by_text(CONFIRM_PATTERN).first.wait_for(timeout=CONFIRM_TIMEOUT_MS)
        return True
    except Exception:
        return False


def _first_line(exc: Exception) -> str:
    text = str(exc).strip() or "(no detail)"
    return text.splitlines()[0]
