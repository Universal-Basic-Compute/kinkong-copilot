@echo off
setlocal enabledelayedexpansion

:: Set version from manifest.json
for /f "tokens=2 delims=:" %%a in ('findstr "version" manifest.json') do (
    set "VERSION=%%a"
    set "VERSION=!VERSION:"=!"
    set "VERSION=!VERSION:,=!"
    set "VERSION=!VERSION: =!"
)

set "PACKAGE_NAME=kinkong-copilot-v%VERSION%"
set "TARGET_DIR=dist\%PACKAGE_NAME%"

echo Packaging KinKong Copilot v%VERSION%...

:: Create clean dist directory
if exist dist rmdir /s /q dist
mkdir "%TARGET_DIR%"

:: Copy required files and directories
echo Copying files...
xcopy /s /i assets "%TARGET_DIR%\assets"
xcopy /s /i lib "%TARGET_DIR%\lib"
xcopy /s /i src "%TARGET_DIR%\src"
copy background.js "%TARGET_DIR%"
copy content.js "%TARGET_DIR%"
copy manifest.json "%TARGET_DIR%"
copy popup.html "%TARGET_DIR%"
copy popup.js "%TARGET_DIR%"

:: Remove development files
echo Removing development files...
del /s /q "%TARGET_DIR%\*.map"
del /s /q "%TARGET_DIR%\*.test.js"

:: Create ZIP file using PowerShell
echo Creating ZIP archive...
powershell -command "Compress-Archive -Path '%TARGET_DIR%' -DestinationPath 'dist\%PACKAGE_NAME%.zip' -Force"

echo Package created: dist\%PACKAGE_NAME%.zip
echo Done!
pause
