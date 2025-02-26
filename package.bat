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
set "TEMP_DIR=temp\%PACKAGE_NAME%"
set "ZIP_FILE=dist\%PACKAGE_NAME%.zip"

echo Packaging KinKong Copilot v%VERSION%...

:: Create clean temp and dist directories
if exist temp rmdir /s /q temp
if exist dist rmdir /s /q dist
mkdir "%TEMP_DIR%"
mkdir "dist"

:: Copy required files and directories
echo Copying files...
xcopy /s /i assets "%TEMP_DIR%\assets"
xcopy /s /i lib "%TEMP_DIR%\lib"
xcopy /s /i src "%TEMP_DIR%\src"
copy background.js "%TEMP_DIR%"
copy content.js "%TEMP_DIR%"
copy manifest.json "%TEMP_DIR%"
copy popup.html "%TEMP_DIR%"
copy popup.js "%TEMP_DIR%"

:: Remove development files
echo Removing development files...
del /s /q "%TEMP_DIR%\*.map"
del /s /q "%TEMP_DIR%\*.test.js"

:: Create ZIP file using PowerShell
echo Creating ZIP archive...
powershell -command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"

:: Clean up temp directory
echo Cleaning up...
rmdir /s /q temp

echo Package created: %ZIP_FILE%
echo Done!
pause
