$ErrorActionPreference = 'Stop'

$BaseUrl = if ($env:SMOKE_API_BASE_URL) { $env:SMOKE_API_BASE_URL } else { 'http://localhost:4000/api' }
$AdminEmail = if ($env:SMOKE_ADMIN_EMAIL) { $env:SMOKE_ADMIN_EMAIL } else { 'admin@workflowhub.local' }
$AdminPassword = if ($env:SMOKE_ADMIN_PASSWORD) { $env:SMOKE_ADMIN_PASSWORD } else { 'Admin123!' }

function Write-Marker {
  param(
    [string]$Key,
    [string]$Value
  )
  Write-Output ("{0}={1}" -f $Key, $Value)
}

$adminToken = $null
$userToken = $null
$taskId = $null

try {
  $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health"
  Write-Marker 'HEALTH' $health.status

  $adminLoginBody = @{
    email = $AdminEmail
    password = $AdminPassword
  } | ConvertTo-Json

  $adminLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body $adminLoginBody
  $adminToken = $adminLogin.token
  if (-not $adminToken) {
    throw 'Missing admin token from login response'
  }
  Write-Marker 'LOGIN_ADMIN' 'ok'

  $userEmail = "rbac+$(Get-Date -Format 'yyyyMMddHHmmssfff')@workflowhub.local"
  $userPassword = 'Rbac123!'
  $registerBody = @{
    name = 'RBAC Smoke User'
    email = $userEmail
    password = $userPassword
  } | ConvertTo-Json

  Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/register" -ContentType 'application/json' -Body $registerBody | Out-Null
  Write-Marker 'REGISTER_USER' 'ok'

  $userLoginBody = @{
    email = $userEmail
    password = $userPassword
  } | ConvertTo-Json

  $userLogin = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body $userLoginBody
  $userToken = $userLogin.token
  if (-not $userToken) {
    throw 'Missing user token from login response'
  }
  Write-Marker 'LOGIN_USER' 'ok'

  $adminHeaders = @{ Authorization = "Bearer $adminToken" }
  $userHeaders = @{ Authorization = "Bearer $userToken" }

  $taskBody = @{
    title = "RBAC Guard Task $(Get-Date -Format 'yyyyMMddHHmmss')"
    description = 'RBAC negative-path validation'
    priority = 'low'
    status = 'submitted'
  } | ConvertTo-Json

  $task = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tasks" -Headers $adminHeaders -ContentType 'application/json' -Body $taskBody
  $taskId = $task.id
  Write-Marker 'TASK_CREATE_ADMIN' $taskId

  $statusBody = @{ status = 'approved' } | ConvertTo-Json

  $forbiddenObserved = $false
  try {
    Invoke-RestMethod -Method Patch -Uri "$BaseUrl/tasks/$taskId/status" -Headers $userHeaders -ContentType 'application/json' -Body $statusBody | Out-Null
    throw 'Expected Forbidden when standard user updates task status'
  }
  catch {
    $statusCode = $null
    if ($_.Exception -and $_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    if ($statusCode -eq 403) {
      $forbiddenObserved = $true
      Write-Marker 'RBAC_FORBIDDEN_STATUS_CHANGE' 'ok'
    }
    else {
      throw
    }
  }

  if (-not $forbiddenObserved) {
    throw 'RBAC check failed: forbidden was not observed'
  }

  Write-Marker 'SMOKE_RBAC_RESULT' 'pass'
  exit 0
}
catch {
  Write-Marker 'SMOKE_RBAC_RESULT' 'fail'
  throw
}
finally {
  if ($adminToken -and $taskId) {
    try {
      $cleanupHeaders = @{ Authorization = "Bearer $adminToken" }
      Invoke-RestMethod -Method Delete -Uri "$BaseUrl/tasks/$taskId" -Headers $cleanupHeaders | Out-Null
      Write-Marker 'TASK_DELETE' $taskId
    }
    catch {
      Write-Marker 'TASK_DELETE' 'cleanup_failed'
    }
  }
}
