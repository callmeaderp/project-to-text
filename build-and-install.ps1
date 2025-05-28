# Project To Text - Build and Install Script (PowerShell)

Write-Host "========================================"
Write-Host "Project To Text - Build and Install Script"
Write-Host "========================================"
Write-Host ""

# Set VS Code path
$vscodePath = "C:\Users\callm\AppData\Local\Programs\Microsoft VS Code\Code.exe"

# Check if VS Code exists
if (-not (Test-Path $vscodePath)) {
    Write-Host "ERROR: VS Code not found at $vscodePath" -ForegroundColor Red
    Write-Host "Please update the vscodePath variable in this script." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version 2>$null
    if (-not $npmVersion) {
        throw "npm not found"
    }
} catch {
    Write-Host "ERROR: npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js and npm first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[1/6] Checking for vsce..." -ForegroundColor Cyan
try {
    npx @vscode/vsce --version 2>&1 | Out-Null
} catch {
    Write-Host "Installing vsce globally..." -ForegroundColor Yellow
    npm install -g @vscode/vsce
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install vsce" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "[2/6] Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[3/6] Compiling TypeScript..." -ForegroundColor Cyan
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: TypeScript compilation failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[4/6] Running linter..." -ForegroundColor Cyan
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Linter reported issues, but continuing..." -ForegroundColor Yellow
}

Write-Host "[5/6] Packaging extension..." -ForegroundColor Cyan
# Remove old .vsix files
Remove-Item *.vsix -ErrorAction SilentlyContinue

# Package the extension (with auto-yes for prompts)
npx @vscode/vsce package --allow-missing-repository
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to package extension" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Find the generated .vsix file
$vsixFile = Get-ChildItem -Filter "*.vsix" | Select-Object -First 1

if (-not $vsixFile) {
    Write-Host "ERROR: No .vsix file found after packaging" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[6/6] Installing extension..." -ForegroundColor Cyan
Write-Host "Installing $($vsixFile.Name)..." -ForegroundColor Gray

& "$vscodePath" --install-extension $vsixFile.FullName --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install extension" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "SUCCESS! Extension installed successfully." -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "You may need to reload VS Code for the changes to take effect."
Write-Host "Press Ctrl+Shift+P and run 'Developer: Reload Window'"
Write-Host ""
Read-Host "Press Enter to exit"