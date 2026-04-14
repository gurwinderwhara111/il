@echo off
REM i3 Video Cutter - Start Script (Windows)

echo.
echo ==========================================
echo i3 Video Cutter - Offline Mode
echo ==========================================
echo.

REM Check if ffmpeg is installed
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: ffmpeg not found
    echo Download from: https://ffmpeg.org/download.html
    echo Or install with: choco install ffmpeg
    pause
    exit /b 1
)

REM Check if ffprobe is installed
where ffprobe >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: ffprobe not found
    echo Usually installed with ffmpeg
    pause
    exit /b 1
)

REM Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python 3 not found
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo √ All dependencies found
echo.

REM Install Python dependencies
echo Installing Python dependencies...
python -m pip install -q Flask Werkzeug

REM Create data folders
if not exist "data\projects" mkdir data\projects
if not exist "data\temp" mkdir data\temp
if not exist "data\cache" mkdir data\cache

REM Start Flask
echo.
echo ==========================================
echo Starting Flask Server...
echo ==========================================
echo Open browser: http://127.0.0.1:5000
echo Press Ctrl+C to stop
echo ==========================================
echo.

python app-i3.py

pause
