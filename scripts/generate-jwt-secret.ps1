$ErrorActionPreference = 'Stop'

# 64 random bytes -> 128-char hex JWT secret
$bytes = New-Object byte[] 64
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
Write-Output $secret
