@echo off
title howlearn-astro DOCX to MDX
cd /d "%~dp0"

python -m streamlit run docx2mdx/app.py

echo.
pause
