@echo off
setlocal
cd /d "%~dp0"

if not exist "dist\index.html" goto build
goto sync

:build
echo [HowLearn] dist not found. Running build:local...
call npm run build:local
if errorlevel 1 goto fail
goto startdev

:sync
echo [HowLearn] Syncing search index to public/pagefind...
call npm run search:sync-dev
if errorlevel 1 goto fail

:startdev
echo.
echo [HowLearn] Dev server: http://localhost:4321/search?q=test
call npm run dev
goto end

:fail
echo [HowLearn] Command failed.
pause
exit /b 1

:end
pause
endlocal
