@echo off
setlocal
cd /d "%~dp0"
echo [HowLearn] Local preview: build + search index + astro preview
echo This may take several minutes.
call npm run preview:local
if errorlevel 1 goto fail
goto end

:fail
echo [HowLearn] Command failed.
pause
exit /b 1

:end
pause
endlocal
