@echo off
setlocal
set "ROOT=%~dp0anchor-agentic"
set "API_URL=http://localhost:8787"
set "WEB_URL=http://localhost:5173"

echo Starting API (wrangler dev) in its own window...
start "AnchorAgentic API" /D "%ROOT%\api" cmd /k "npm run dev"

echo Waiting for API at %API_URL% ...
set /a tries=0
:wait_api
rem Any HTTP response (even 404) means the Worker is up; curl only fails on connection errors.
curl -s -o nul %API_URL% >nul 2>&1 && goto api_ready
set /a tries+=1
if %tries% geq 60 (
    echo API did not respond after 60s - starting web anyway. Check the API window for errors.
    goto api_ready
)
timeout /t 1 /nobreak >nul
goto wait_api

:api_ready
echo Starting web UI (vite dev) in its own window...
start "AnchorAgentic Web" /D "%ROOT%\web" cmd /k "npm run dev"

echo.
echo   API: %API_URL%
echo   Web: %WEB_URL%
echo Close the two server windows to stop them.
endlocal
