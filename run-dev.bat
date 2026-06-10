@echo off
setlocal
cd /d "%~dp0"

echo [math-howlearn] Starting dev server...

if not exist "node_modules\" goto install_deps
goto check_dist

:install_deps
echo [math-howlearn] Installing dependencies...
call npm install
if errorlevel 1 goto fail

:check_dist
if not exist "dist\index.html" goto build_dist
goto start_dev

:build_dist
echo [math-howlearn] dist/ missing. Running build:local - may take a few minutes...
call npm run build:local
if errorlevel 1 goto fail

:start_dev
echo.
echo [math-howlearn] Syncing search index and starting dev server
echo [math-howlearn] http://localhost:4321/search?q=test
echo.

call npm run dev:search
goto end

:fail
echo [math-howlearn] Command failed.
pause
exit /b 1

:end
pause
endlocal
