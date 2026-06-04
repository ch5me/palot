@echo off
:: elfcmd — Open the installed Elf desktop application on Windows.
::
:: This script is bundled with the Elf installation and can be added
:: to PATH by the "Install CLI Command" action.

setlocal

set "SCRIPT_DIR=%~dp0"
set "APP_EXE=%SCRIPT_DIR%..\Elfexe"

if exist "%APP_EXE%" (
    start "" "%APP_EXE%" %*
) else (
    echo Error: Could not find Elfexe at %APP_EXE% 1>&2
    echo Try launching from the Start Menu instead. 1>&2
    exit /b 1
)
