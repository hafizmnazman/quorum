@echo off
title Quorum
cd /d "%~dp0"
echo Quorum running at http://127.0.0.1:8000  (close this window to stop)
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8000"
python -m uvicorn server:app --port 8000
