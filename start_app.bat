@echo off
echo Starting Hustle App...
echo.

REM Set the project directory
set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

REM Start Django Backend Server
echo Starting Django Backend Server...
start "Django Backend" cmd /k "cd /d "%PROJECT_DIR%backend" && py manage.py runserver"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start React Frontend Server
echo Starting React Frontend Server...
start "React Frontend" cmd /k "cd /d "%PROJECT_DIR%frontend" && set PATH=%PATH%;C:\Program Files\nodejs && npm run dev"

REM Wait a moment for frontend to start
timeout /t 5 /nobreak > nul

echo.
echo ========================================
echo Hustle App is starting up!
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Both servers are starting in separate windows.
echo Close those windows to stop the servers.
echo ========================================
echo.

REM Keep this window open for a moment to show the status
timeout /t 10 /nobreak > nul

echo App startup complete! You can close this window.
pause

