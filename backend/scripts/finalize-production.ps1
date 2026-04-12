param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$VercelDomain,

  [string]$BackendPath = "C:\Users\admin\Desktop\block\backend",
  [string]$RailwayDomain = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function New-RandomBase64([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  [Convert]::ToBase64String($buffer)
}

function Invoke-CurlStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [string[]]$Headers = @(),
    [string]$Method = "GET",
    [string]$Body = ""
  )

  $tempFile = Join-Path $env:TEMP ("mx-curl-" + [guid]::NewGuid().ToString("N") + ".json")
  try {
    $args = @("-s", "-o", "NUL", "-w", "%{http_code}", "-X", $Method)
    foreach ($header in $Headers) {
      $args += @("-H", $header)
    }
    if ($Body) {
      Set-Content -Path $tempFile -Value $Body -NoNewline
      $args += @("--data-binary", "@$tempFile")
    }
    $args += $Url
    $code = (& curl.exe @args).Trim()
    return $code
  } finally {
    if (Test-Path $tempFile) {
      Remove-Item $tempFile -Force
    }
  }
}

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Step "Validating CLIs"
node -v
npm.cmd -v
railway.cmd --version
vercel.cmd --version

Write-Step "Checking Railway authentication"
try {
  $railwayWhoami = railway.cmd whoami
  if (-not $railwayWhoami) {
    throw "No authenticated Railway account found."
  }
  Write-Host "Railway account: $railwayWhoami"
} catch {
  throw "Railway CLI is not authenticated. Run 'railway login' in an interactive terminal, then rerun this script."
}

if (-not (Test-Path $BackendPath)) {
  throw "Backend path not found: $BackendPath"
}

Set-Location $BackendPath

Write-Step "Ensuring Railway project/service is linked"
try {
  railway.cmd status | Out-Host
} catch {
  Write-Host "Railway service is not linked yet. Running railway link..." -ForegroundColor Yellow
  railway.cmd link
  railway.cmd status | Out-Host
}

Write-Step "Generating secure secrets"
$JWT_SECRET = New-RandomBase64 64
$JWT_REFRESH_SECRET = New-RandomBase64 64
$ENCRYPTION_KEY = New-RandomBase64 32

Write-Step "Setting Railway environment variables"
railway.cmd variables set NODE_ENV=production
railway.cmd variables set DATABASE_URL="$DatabaseUrl"
railway.cmd variables set JWT_SECRET="$JWT_SECRET"
railway.cmd variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
railway.cmd variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"
railway.cmd variables set CLIENT_URLS="$VercelDomain"
railway.cmd variables set CLIENT_URL_PATTERNS="https://*.vercel.app"
railway.cmd variables set AUTH_RATE_LIMIT_WINDOW_MS=900000
railway.cmd variables set AUTH_RATE_LIMIT_MAX=20

Write-Step "Deploying backend to Railway"
railway.cmd up

if (-not $RailwayDomain) {
  Write-Step "Reading Railway public domain"
  $domainOutput = railway.cmd domain
  $match = [regex]::Match($domainOutput, "https://[^\s]+")
  if (-not $match.Success) {
    throw "Unable to parse Railway domain from output. Set -RailwayDomain manually and rerun."
  }
  $RailwayDomain = $match.Value.TrimEnd("/")
}

Write-Step "Using Railway domain: $RailwayDomain"

Write-Step "Verifying backend endpoints"
$healthCode = Invoke-CurlStatus -Url "$RailwayDomain/api/health"
$loginCode = Invoke-CurlStatus -Url "$RailwayDomain/api/auth/login" -Method "POST" -Headers @("Content-Type: application/json") -Body '{"email":"bad@example.com","password":"wrongpass"}'
$walletCode = Invoke-CurlStatus -Url "$RailwayDomain/api/wallet/balances"
$tradeCode = Invoke-CurlStatus -Url "$RailwayDomain/api/trade/open-orders"

Write-Host "health code: $healthCode"
Write-Host "login (bad creds) code: $loginCode"
Write-Host "wallet (no token) code: $walletCode"
Write-Host "trade (no token) code: $tradeCode"

Write-Step "CORS verification against Vercel origin"
$corsHealth = & curl.exe -s -i -H "Origin: $VercelDomain" "$RailwayDomain/api/health"
$corsPreflight = & curl.exe -s -i -X OPTIONS "$RailwayDomain/api/auth/login" -H "Origin: $VercelDomain" -H "Access-Control-Request-Method: POST"

Write-Host ($corsHealth | Select-String -Pattern "HTTP/|access-control-allow-origin|access-control-allow-credentials")
Write-Host ($corsPreflight | Select-String -Pattern "HTTP/|access-control-allow-origin|access-control-allow-credentials|access-control-allow-methods")

Write-Step "Updating Vercel API base URL for production"
$baseApi = "$RailwayDomain/api"
Set-Location (Split-Path $BackendPath -Parent)
Set-Location ".\frontend"

try {
  $vercelWhoami = vercel.cmd whoami
  if (-not $vercelWhoami) {
    throw "No authenticated Vercel account found."
  }
  Write-Host "Vercel account: $vercelWhoami"
} catch {
  throw "Vercel CLI is not authenticated. Run 'vercel login' and rerun this script."
}

try {
  $baseApi | vercel.cmd env add NEXT_PUBLIC_API_BASE_URL production | Out-Host
} catch {
  vercel.cmd env rm NEXT_PUBLIC_API_BASE_URL production --yes | Out-Host
  $baseApi | vercel.cmd env add NEXT_PUBLIC_API_BASE_URL production | Out-Host
}
vercel.cmd --prod --yes

Write-Step "Final validation summary"
Write-Host "Frontend URL: https://frontend-phi-three-14.vercel.app"
Write-Host "Backend URL: $RailwayDomain"
Write-Host "Expected healthy state: /api/health => 200 + database up"
Write-Host "Expected auth state: /api/auth/login => 401 for bad creds, not 503"
