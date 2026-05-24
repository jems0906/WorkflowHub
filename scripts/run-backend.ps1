$ErrorActionPreference = 'Stop'

$Mode = 'dev'
$Port = 4000

if ($args.Count -ge 1 -and -not [string]::IsNullOrWhiteSpace($args[0])) {
  $Mode = $args[0].ToLowerInvariant()
}

if ($args.Count -ge 2 -and -not [string]::IsNullOrWhiteSpace($args[1])) {
  $Port = [int]$args[1]
}

if ($Mode -ne 'dev' -and $Mode -ne 'start') {
  throw "Invalid mode '$Mode'. Expected 'dev' or 'start'."
}

function Write-Marker {
  param(
    [string]$Key,
    [string]$Value
  )
  Write-Output ("{0}={1}" -f $Key, $Value)
}

$scriptDirectory = Split-Path -Parent $PSCommandPath
$repoRoot = Split-Path -Parent $scriptDirectory
$backendPath = Join-Path $repoRoot 'backend'

if (-not (Test-Path $backendPath)) {
  throw 'Missing backend directory'
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  Write-Marker 'BACKEND_STATUS' "already_running_on_$Port"
  exit 0
}

if ($Mode -eq 'start') {
  Write-Marker 'BACKEND_STATUS' 'starting_prod'
  & npm run start --prefix $backendPath
  exit $LASTEXITCODE
}

Write-Marker 'BACKEND_STATUS' 'starting_dev'
& npm run dev --prefix $backendPath
exit $LASTEXITCODE
