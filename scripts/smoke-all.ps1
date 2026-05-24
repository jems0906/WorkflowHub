$ErrorActionPreference = 'Stop'

function Write-Marker {
  param(
    [string]$Key,
    [string]$Value
  )
  Write-Output ("{0}={1}" -f $Key, $Value)
}

$scriptDirectory = Split-Path -Parent $PSCommandPath
$apiScript = Join-Path $scriptDirectory 'smoke-api.ps1'
$rbacScript = Join-Path $scriptDirectory 'smoke-rbac.ps1'

if (-not (Test-Path $apiScript)) {
  throw 'Missing scripts/smoke-api.ps1'
}

if (-not (Test-Path $rbacScript)) {
  throw 'Missing scripts/smoke-rbac.ps1'
}

try {
  Write-Marker 'SMOKE_ALL_PHASE' 'api_start'
  & powershell -ExecutionPolicy Bypass -File $apiScript
  if ($LASTEXITCODE -ne 0) {
    throw 'smoke-api failed'
  }
  Write-Marker 'SMOKE_ALL_PHASE' 'api_pass'

  Write-Marker 'SMOKE_ALL_PHASE' 'rbac_start'
  & powershell -ExecutionPolicy Bypass -File $rbacScript
  if ($LASTEXITCODE -ne 0) {
    throw 'smoke-rbac failed'
  }
  Write-Marker 'SMOKE_ALL_PHASE' 'rbac_pass'

  Write-Marker 'SMOKE_ALL_RESULT' 'pass'
  exit 0
}
catch {
  Write-Marker 'SMOKE_ALL_RESULT' 'fail'
  throw
}
