@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto node_missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto node_missing
if not exist .env.local copy .env.example .env.local >nul
call npm ci
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo.
echo Open http://127.0.0.1:4173 in your browser.
echo Chat requires your Anthropic key in .env.local. Restart after editing it.
echo Keep this window open while using LEOPA. Press Ctrl+C to stop.
call npm start
if errorlevel 1 goto failed
popd
exit /b 0
:node_missing
echo Install Node.js 22 or newer, then open this file again.
pause
popd
exit /b 1
:failed
echo.
echo LEOPA did not start. Read the error above or send a screenshot for help.
pause
popd
exit /b 1
