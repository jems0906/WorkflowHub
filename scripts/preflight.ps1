$ErrorActionPreference = 'Stop'

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
$smokeAllScript = Join-Path $scriptDirectory 'smoke-all.ps1'
$envFilePath = Join-Path $backendPath '.env'

if (-not (Test-Path $backendPath)) {
  throw 'Missing backend directory'
}

if (-not (Test-Path $smokeAllScript)) {
  throw 'Missing scripts/smoke-all.ps1'
}

$envMap = @{}
if (Test-Path $envFilePath) {
  Get-Content $envFilePath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith('#')) { return }
    if ($line -notmatch '=') { return }

    $parts = $line.Split('=', 2)
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $envMap[$key] = $value
  }
}

function Get-ConfigValue {
  param(
    [string]$Name
  )

  $envValue = [Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($envValue)) {
    return $envValue
  }

  if ($envMap.ContainsKey($Name)) {
    return $envMap[$Name]
  }

  return $null
}

$requiredConfig = @('DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL')
$strictMode = [Environment]::GetEnvironmentVariable('PREFLIGHT_STRICT') -eq '1'

try {
  Write-Marker 'PREFLIGHT_PHASE' 'config_sanity_start'

  foreach ($name in $requiredConfig) {
    $value = Get-ConfigValue -Name $name
    if ([string]::IsNullOrWhiteSpace($value)) {
      throw "Missing required config: $name"
    }
  }

  $jwtSecret = Get-ConfigValue -Name 'JWT_SECRET'
  if ($jwtSecret -match '^change_me' -or $jwtSecret.Length -lt 16) {
    if ($strictMode) {
      throw 'JWT_SECRET appears weak/default; set a strong secret before release'
    }
    Write-Marker 'PREFLIGHT_WARNING' 'weak_jwt_secret_detected'
  }

  Write-Marker 'PREFLIGHT_PHASE' 'config_sanity_pass'

  Write-Marker 'PREFLIGHT_PHASE' 'build_start'
  & npm run build --prefix $backendPath
  if ($LASTEXITCODE -ne 0) {
    throw 'Backend build failed'
  }
  Write-Marker 'PREFLIGHT_PHASE' 'build_pass'

  Write-Marker 'PREFLIGHT_PHASE' 'smoke_start'
  & powershell -ExecutionPolicy Bypass -File $smokeAllScript
  if ($LASTEXITCODE -ne 0) {
    throw 'Smoke suite failed'
  }
  Write-Marker 'PREFLIGHT_PHASE' 'smoke_pass'

  Write-Marker 'PREFLIGHT_RESULT' 'pass'
  exit 0
}
catch {
  Write-Marker 'PREFLIGHT_RESULT' 'fail'
  throw
}
