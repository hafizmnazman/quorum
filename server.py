"""Quorum server: serves the UI, runs the engine in a thread, streams events via SSE."""

from __future__ import annotations

import asyncio
import json
import queue
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import submitter

WEB_DIR = Path(__file__).parent / "web"

app = FastAPI(title="Quorum")


class RunRequest(BaseModel):
    profile: str
    count: int = Field(default=10, ge=1)
    min_delay: float = Field(default=2.0, ge=0)
    max_delay: float = Field(default=6.0, ge=0)
    headless: bool = True


class Run:
    def __init__(self):
        self.id = uuid.uuid4().hex
        self.events: queue.Queue[dict] = queue.Queue()
        self.stop = threading.Event()
        self.finished = threading.Event()


_lock = threading.Lock()
_runs: dict[str, Run] = {}
_active: Run | None = None


def _worker(run: Run, profile: submitter.Profile, req: RunRequest) -> None:
    global _active
    try:
        submitter.run(
            profile=profile,
            count=req.count,
            headless=req.headless,
            min_delay=req.min_delay,
            max_delay=req.max_delay,
            emit=run.events.put,
            should_stop=run.stop.is_set,
        )
    except Exception as exc:
        run.events.put({
            "type": "log", "i": 0, "total": req.count, "status": "error",
            "msg": f"Run failed: {type(exc).__name__}: {exc}",
        })
        run.events.put({"type": "done", "ok": 0, "total": req.count})
    finally:
        run.finished.set()
        with _lock:
            if _active is run:
                _active = None


@app.get("/")
def index():
    return FileResponse(WEB_DIR / "index.html")


@app.get("/api/profiles")
def profiles():
    return [{"name": p.name, "url": p.url} for p in submitter.list_profiles()]


@app.post("/api/run")
def start_run(req: RunRequest):
    global _active
    if req.min_delay > req.max_delay:
        raise HTTPException(422, "min_delay must be <= max_delay")
    try:
        profile = submitter.load_profile(req.profile)
    except LookupError as exc:
        raise HTTPException(404, str(exc))

    with _lock:
        if _active is not None and not _active.finished.is_set():
            raise HTTPException(409, "A run is already in progress")
        run = Run()
        _runs[run.id] = run
        _active = run

    threading.Thread(target=_worker, args=(run, profile, req), daemon=True).start()
    return {"run_id": run.id}


@app.post("/api/stop")
def stop_run():
    with _lock:
        run = _active
    if run is None or run.finished.is_set():
        return {"stopped": False}
    run.stop.set()
    return {"stopped": True}


@app.get("/api/stream/{run_id}")
async def stream(run_id: str):
    run = _runs.get(run_id)
    if run is None:
        raise HTTPException(404, "Unknown run id")

    async def generate():
        while True:
            try:
                event = run.events.get_nowait()
            except queue.Empty:
                if run.finished.is_set() and run.events.empty():
                    break
                await asyncio.sleep(0.1)
                continue
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") == "done":
                break
        _runs.pop(run_id, None)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


app.mount("/web", StaticFiles(directory=WEB_DIR), name="web")
