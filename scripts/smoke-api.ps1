$ErrorActionPreference = 'Stop'

function Get-EnvOrDefault {
  param(
    [string]$Name,
    [string]$DefaultValue
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }
  return $value
}

$BaseUrl = Get-EnvOrDefault -Name 'SMOKE_API_BASE_URL' -DefaultValue 'http://localhost:4000/api'
$AdminEmail = Get-EnvOrDefault -Name 'SMOKE_ADMIN_EMAIL' -DefaultValue 'admin@workflowhub.local'
$AdminPassword = Get-EnvOrDefault -Name 'SMOKE_ADMIN_PASSWORD' -DefaultValue 'Admin123!'

function Write-Marker {
  param(
    [string]$Key,
    [string]$Value
  )
  Write-Output ("{0}={1}" -f $Key, $Value)
}

$token = $null
$taskId = $null

try {
  $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health"
  Write-Marker 'HEALTH' $health.status

  $loginBody = @{
    email = $AdminEmail
    password = $AdminPassword
  } | ConvertTo-Json

  $login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body $loginBody
  $token = $login.token
  if (-not $token) {
    throw 'Missing token from login response'
  }
  Write-Marker 'LOGIN_ADMIN' 'ok'

  $headers = @{ Authorization = "Bearer $token" }

  $taskBody = @{
    title = "Smoke Task $(Get-Date -Format 'yyyyMMddHHmmss')"
    description = 'Automated smoke run'
    priority = 'medium'
    status = 'submitted'
  } | ConvertTo-Json

  $task = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tasks" -Headers $headers -ContentType 'application/json' -Body $taskBody
  $taskId = $task.id
  Write-Marker 'TASK_CREATE' $taskId

  $statusBody = @{ status = 'in_review' } | ConvertTo-Json
  $status = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/tasks/$taskId/status" -Headers $headers -ContentType 'application/json' -Body $statusBody
  Write-Marker 'TASK_STATUS' $status.status

  $commentBody = @{ content = 'Automated smoke comment' } | ConvertTo-Json
  $comment = Invoke-RestMethod -Method Post -Uri "$BaseUrl/tasks/$taskId/comments" -Headers $headers -ContentType 'application/json' -Body $commentBody
  Write-Marker 'COMMENT_CREATE' $comment.id

  $users = Invoke-RestMethod -Method Get -Uri "$BaseUrl/users" -Headers $headers
  $candidate = $users | Where-Object { $_.id -ne $task.assigned_to } | Select-Object -First 1
  if (-not $candidate) {
    throw 'No reassignment candidate found'
  }

  $updateBody = @{ assigned_to = $candidate.id } | ConvertTo-Json
  $updated = Invoke-RestMethod -Method Put -Uri "$BaseUrl/tasks/$taskId" -Headers $headers -ContentType 'application/json' -Body $updateBody
  Write-Marker 'TASK_REASSIGN' $updated.assigned_to

  $history = Invoke-RestMethod -Method Get -Uri "$BaseUrl/tasks/$taskId/history" -Headers $headers
  Write-Marker 'HISTORY_COUNT' ([string]$history.Count)

  $list = Invoke-RestMethod -Method Get -Uri "$BaseUrl/tasks?search=Smoke&status=in_review&sort_by=updated_at&sort_dir=desc&page=1&limit=5" -Headers $headers
  Write-Marker 'LIST_TOTAL' ([string]$list.total)

  $stats = Invoke-RestMethod -Method Get -Uri "$BaseUrl/tasks/stats" -Headers $headers
  if (-not $stats) {
    throw 'Stats response was empty'
  }
  Write-Marker 'STATS' 'ok'

  $notifications = Invoke-RestMethod -Method Get -Uri "$BaseUrl/notifications" -Headers $headers
  Write-Marker 'NOTIFICATIONS_COUNT' ([string]$notifications.Count)

  if ($notifications.Count -gt 0) {
    $notificationId = $notifications[0].id
    Invoke-RestMethod -Method Patch -Uri "$BaseUrl/notifications/$notificationId/read" -Headers $headers | Out-Null
    Write-Marker 'NOTIFICATION_MARK_READ' $notificationId
  }

  Write-Marker 'SMOKE_RESULT' 'pass'
  exit 0
}
catch {
  Write-Marker 'SMOKE_RESULT' 'fail'
  throw
}
finally {
  if ($token -and $taskId) {
    try {
      $cleanupHeaders = @{ Authorization = "Bearer $token" }
      Invoke-RestMethod -Method Delete -Uri "$BaseUrl/tasks/$taskId" -Headers $cleanupHeaders | Out-Null
      Write-Marker 'TASK_DELETE' $taskId
    }
    catch {
      Write-Marker 'TASK_DELETE' 'cleanup_failed'
    }
  }
}
