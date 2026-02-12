# API Testing Script for V2 Resort Backend
$baseUrl = "http://localhost:3005"

function Test-Endpoint {
    param($method, $uri, $body, $headers)
    
    $url = "$baseUrl$uri"
    try {
        $params = @{
            Uri = $url
            Method = $method
            UseBasicParsing = $true
            TimeoutSec = 10
            ContentType = "application/json"
        }
        if ($body) { $params.Body = $body }
        if ($headers) { $params.Headers = $headers }
        
        $r = Invoke-WebRequest @params
        return @{ Status = $r.StatusCode; Body = $r.Content; Success = $true }
    } catch {
        $status = 0
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
            $reader.Close()
        } else {
            $body = $_.Exception.Message
        }
        return @{ Status = $status; Body = $body; Success = $false }
    }
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "V2 RESORT BACKEND API TEST RESULTS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl"
Write-Host "Test Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# PUBLIC ENDPOINTS
Write-Host "`n=== PUBLIC ENDPOINTS ===" -ForegroundColor Green

$endpoints = @(
    @{ Method = "GET"; Uri = "/health"; Desc = "Health check (root)" },
    @{ Method = "GET"; Uri = "/api/health"; Desc = "API Health check" },
    @{ Method = "GET"; Uri = "/api/settings"; Desc = "Public settings" },
    @{ Method = "GET"; Uri = "/api/modules"; Desc = "Available modules" },
    @{ Method = "GET"; Uri = "/api/v1/pool/sessions"; Desc = "Pool sessions" },
    @{ Method = "GET"; Uri = "/api/v1/restaurant/menu"; Desc = "Restaurant menu" },
    @{ Method = "GET"; Uri = "/api/v1/chalets"; Desc = "Chalets list" }
)

$results = @()
foreach ($ep in $endpoints) {
    $r = Test-Endpoint -method $ep.Method -uri $ep.Uri
    $statusColor = if ($r.Success) { "Green" } else { "Red" }
    Write-Host "$($ep.Method) $($ep.Uri)" -NoNewline
    Write-Host " [$($r.Status)]" -ForegroundColor $statusColor -NoNewline
    $preview = if ($r.Body.Length -gt 100) { $r.Body.Substring(0,100) + "..." } else { $r.Body }
    Write-Host " - $preview"
    $results += @{ Endpoint = "$($ep.Method) $($ep.Uri)"; Status = $r.Status; Success = $r.Success; Desc = $ep.Desc }
}

# AUTH ENDPOINT
Write-Host "`n=== AUTH ENDPOINT ===" -ForegroundColor Yellow
$loginBody = '{"email":"admin@v2resort.com","password":"admin123"}'
$authResult = Test-Endpoint -method "POST" -uri "/api/v1/auth/login" -body $loginBody
$authColor = if ($authResult.Success) { "Green" } else { "Red" }
Write-Host "POST /api/v1/auth/login" -NoNewline
Write-Host " [$($authResult.Status)]" -ForegroundColor $authColor
Write-Host "   Response: $($authResult.Body)"

$token = $null
if ($authResult.Success -and $authResult.Body) {
    try {
        $authJson = $authResult.Body | ConvertFrom-Json
        if ($authJson.token) { $token = $authJson.token }
        elseif ($authJson.data.token) { $token = $authJson.data.token }
        elseif ($authJson.access_token) { $token = $authJson.access_token }
        elseif ($authJson.data.access_token) { $token = $authJson.data.access_token }
    } catch {}
}

if ($token) {
    Write-Host "   Token obtained: $($token.Substring(0, [Math]::Min(50, $token.Length)))..." -ForegroundColor Green
} else {
    Write-Host "   No token obtained from response" -ForegroundColor Red
}

# PROTECTED ENDPOINTS
Write-Host "`n=== PROTECTED ENDPOINTS ===" -ForegroundColor Magenta

$protectedEndpoints = @(
    @{ Method = "GET"; Uri = "/api/v1/users"; Desc = "Users list" },
    @{ Method = "GET"; Uri = "/api/v1/staff"; Desc = "Staff list" },
    @{ Method = "GET"; Uri = "/api/v1/inventory"; Desc = "Inventory" },
    @{ Method = "GET"; Uri = "/api/v1/admin/settings"; Desc = "Admin settings" },
    @{ Method = "GET"; Uri = "/api/v1/finance/summary"; Desc = "Finance summary" },
    @{ Method = "GET"; Uri = "/api/v1/reporting/dashboard"; Desc = "Reporting dashboard" },
    @{ Method = "GET"; Uri = "/api/v1/loyalty/programs"; Desc = "Loyalty programs" },
    @{ Method = "GET"; Uri = "/api/v1/coupons"; Desc = "Coupons" },
    @{ Method = "GET"; Uri = "/api/v1/giftcards"; Desc = "Gift cards" },
    @{ Method = "GET"; Uri = "/api/v1/support/tickets"; Desc = "Support tickets" }
)

$headers = @{}
if ($token) {
    $headers = @{ "Authorization" = "Bearer $token" }
}

foreach ($ep in $protectedEndpoints) {
    $r = Test-Endpoint -method $ep.Method -uri $ep.Uri -headers $headers
    $statusColor = if ($r.Success) { "Green" } elseif ($r.Status -eq 401 -or $r.Status -eq 403) { "Yellow" } else { "Red" }
    Write-Host "$($ep.Method) $($ep.Uri)" -NoNewline
    Write-Host " [$($r.Status)]" -ForegroundColor $statusColor -NoNewline
    $preview = if ($r.Body.Length -gt 100) { $r.Body.Substring(0,100) + "..." } else { $r.Body }
    Write-Host " - $preview"
    $results += @{ Endpoint = "$($ep.Method) $($ep.Uri)"; Status = $r.Status; Success = $r.Success; Desc = $ep.Desc }
}

# SUMMARY
Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
$working = ($results | Where-Object { $_.Success }).Count
$total = $results.Count
Write-Host "Working endpoints: $working / $total"
Write-Host "Auth token obtained: $(if ($token) { 'YES' } else { 'NO' })"
