# Builds the release APK, working around the Windows 260-char MAX_PATH limit.
#
# The withShortCmakePath Expo config plugin injects two mitigations:
#
#   1. CMAKE_OBJECT_PATH_MAX=150 in defaultConfig — tells CMake to MD5-hash
#      any object filename that would otherwise exceed 150 chars.
#
#   2. buildStagingDirectory "D:/b" in build.gradle (Windows only) — redirects
#      ALL CMake staging output to a short path so ninja never constructs a
#      >260-char filename.
#
# This script simply ensures D:/b exists and runs assembleRelease.

$projectRoot = Split-Path -Parent $PSScriptRoot          # .../hang-up

# Ensure the short CMake staging directory exists
New-Item -ItemType Directory -Force -Path 'D:/b' | Out-Null

$exitCode = 1
try {
    Push-Location "$projectRoot\android"
    Write-Host "Building from $(Get-Location) ..."
    $env:NODE_ENV = "production"
    & ".\gradlew.bat" assembleRelease
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exitCode -eq 0) {
    $apkDir = "$projectRoot\android\app\build\outputs\apk\release"
    if (Test-Path $apkDir) {
        Write-Host ""
        Write-Host "Build succeeded. APK(s):" -ForegroundColor Green
        Get-ChildItem "$apkDir\*.apk" | ForEach-Object { Write-Host "  $($_.FullName)" }
    }
}

exit $exitCode
