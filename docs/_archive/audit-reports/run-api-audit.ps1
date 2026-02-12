$ErrorActionPreference = "SilentlyContinue"
$base = "http://localhost:3005"

# Get auth token
$body = '{"email":"admin@v2resort.com","password":"admin123"}'
$resp = Invoke-RestMethod -Uri "$base/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body
$token = $resp.data.tokens.accessToken
$headers = @{ "Authorization" = "Bearer $token" }

Write-Host "V2 HOSPITALITY PLATFORM - API AUDIT" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Public Endpoints
$publicResults = @()
$publicEndpoints = @(
    @{path="/health"; desc="Health Check"},
    @{path="/api/health"; desc="API Health"},
    @{path="/api/settings"; desc="Site Settings"},
    @{path="/api/modules"; desc="Module List"},
    @{path="/api/weather"; desc="Weather"},
    @{path="/api/v1/units"; desc="Generic Units"},
    @{path="/api/v1/facilities/sessions"; desc="Facility Sessions"},
    @{path="/api/v1/dining/menu"; desc="Dining Menu"},
    @{path="/api/v1/terminology"; desc="Terminology"},
    @{path="/api/v1/restaurant/menu"; desc="Restaurant Menu"},
    @{path="/api/v1/restaurant/menu/categories"; desc="Menu Categories"},
    @{path="/api/v1/pool/sessions"; desc="Pool Sessions"},
    @{path="/api/v1/chalets"; desc="Chalets"},
    @{path="/api/v1/loyalty/settings"; desc="Loyalty Settings"},
    @{path="/api/v1/loyalty/tiers"; desc="Loyalty Tiers"},
    @{path="/api/v1/reviews"; desc="Public Reviews"}
)

Write-Host "[PUBLIC ENDPOINTS]" -ForegroundColor Yellow
foreach ($ep in $publicEndpoints) {
    try {
        $r = Invoke-WebRequest -Uri "$base$($ep.path)" -UseBasicParsing -TimeoutSec 5
        $status = $r.StatusCode
        $icon = "OK"
    } catch {
        $status = [int]$_.Exception.Response.StatusCode
        if ($status -eq 0) { $status = "ERR" }
        $icon = "FAIL"
    }
    $publicResults += "$icon`t$status`t$($ep.path)`t$($ep.desc)"
    Write-Host "$icon`t$status`t$($ep.path)"
}

# Protected Endpoints
$protectedResults = @()
$protectedEndpoints = @(
    @{path="/api/v1/auth/me"; desc="Current User"},
    @{path="/api/v1/users"; desc="User List"},
    @{path="/api/v1/admin/settings"; desc="Admin Settings"},
    @{path="/api/v1/admin/modules"; desc="Admin Modules"},
    @{path="/api/v1/manager/approvals"; desc="Manager Approvals"},
    @{path="/api/v1/manager/approvals/pending"; desc="Pending Approvals"},
    @{path="/api/v1/manager/approvals/stats"; desc="Approval Stats"},
    @{path="/api/v1/manager/shifts"; desc="Manager Shifts"},
    @{path="/api/v1/inventory/categories"; desc="Inventory Categories"},
    @{path="/api/v1/inventory/items"; desc="Inventory Items"},
    @{path="/api/v1/inventory/transactions"; desc="Inventory Transactions"},
    @{path="/api/v1/inventory/alerts"; desc="Stock Alerts"},
    @{path="/api/v1/coupons"; desc="Coupons"},
    @{path="/api/v1/giftcards"; desc="Gift Cards"},
    @{path="/api/v1/loyalty/accounts"; desc="Loyalty Accounts"},
    @{path="/api/v1/loyalty/stats"; desc="Loyalty Stats"},
    @{path="/api/v1/reviews/admin"; desc="Admin Reviews"},
    @{path="/api/v1/housekeeping/tasks"; desc="Housekeeping Tasks"},
    @{path="/api/v1/payments/methods"; desc="Payment Methods"},
    @{path="/api/v1/devices"; desc="Devices"},
    @{path="/api/v1/promotions"; desc="Promotions"},
    @{path="/api/v1/reports"; desc="Reports"},
    @{path="/api/v1/restaurant/orders"; desc="Restaurant Orders"},
    @{path="/api/v1/restaurant/waitlist"; desc="Waitlist"},
    @{path="/api/v1/pool/tickets"; desc="Pool Tickets"},
    @{path="/api/v1/pool/bookings"; desc="Pool Bookings"},
    @{path="/api/v1/snack/menu"; desc="Snack Menu"},
    @{path="/api/v1/snack/orders"; desc="Snack Orders"}
)

Write-Host ""
Write-Host "[PROTECTED ENDPOINTS]" -ForegroundColor Yellow
foreach ($ep in $protectedEndpoints) {
    try {
        $r = Invoke-WebRequest -Uri "$base$($ep.path)" -Headers $headers -UseBasicParsing -TimeoutSec 5
        $status = $r.StatusCode
        $icon = "OK"
    } catch {
        $status = [int]$_.Exception.Response.StatusCode
        if ($status -eq 0) { $status = "ERR" }
        $icon = "FAIL"
    }
    $protectedResults += "$icon`t$status`t$($ep.path)`t$($ep.desc)"
    Write-Host "$icon`t$status`t$($ep.path)"
}

# Save results
$allResults = @("=== PUBLIC ENDPOINTS ===") + $publicResults + @("", "=== PROTECTED ENDPOINTS ===") + $protectedResults
$allResults | Out-File -FilePath "api-audit-results.txt" -Encoding UTF8

Write-Host ""
Write-Host "Results saved to api-audit-results.txt" -ForegroundColor Green

# Summary
$pubOK = ($publicResults | Where-Object { $_ -match "^OK" }).Count
$protOK = ($protectedResults | Where-Object { $_ -match "^OK" }).Count
Write-Host ""
Write-Host "SUMMARY:" -ForegroundColor Cyan
Write-Host "  Public:    $pubOK/$($publicEndpoints.Count) working"
Write-Host "  Protected: $protOK/$($protectedEndpoints.Count) working"
