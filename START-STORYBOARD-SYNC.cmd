@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Node.js is required. & pause & exit /b 1)
where gh >nul 2>nul
if errorlevel 1 (echo GitHub CLI is required. Install it and run gh auth login. & pause & exit /b 1)
gh auth status >nul 2>nul
if errorlevel 1 (echo Sign in first with gh auth login. & pause & exit /b 1)
node tools\serve-storyboard-sync.mjs
pause
