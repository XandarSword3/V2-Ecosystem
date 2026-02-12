$ErrorActionPreference = "SilentlyContinue"
$base = "http://localhost:3000"

Write-Host "V2 HOSPITALITY PLATFORM - FRONTEND PAGE AUDIT" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$pages = @(
    # Public Pages
    @{path="/"; desc="Homepage"; category="Public"},
    @{path="/login"; desc="Login"; category="Public"},
    @{path="/register"; desc="Register"; category="Public"},
    @{path="/forgot-password"; desc="Forgot Password"; category="Public"},
    @{path="/contact"; desc="Contact"; category="Public"},
    @{path="/privacy"; desc="Privacy Policy"; category="Public"},
    @{path="/terms"; desc="Terms & Conditions"; category="Public"},
    @{path="/reviews"; desc="Reviews"; category="Public"},
    
    # Module Pages
    @{path="/restaurant"; desc="Restaurant"; category="Module"},
    @{path="/pool"; desc="Pool/Fitness"; category="Module"},
    @{path="/chalets"; desc="Chalets"; category="Module"},
    @{path="/loyalty"; desc="Loyalty Program"; category="Module"},
    @{path="/snack"; desc="Snack Bar"; category="Module"},
    
    # Admin Pages
    @{path="/admin"; desc="Admin Dashboard"; category="Admin"},
    @{path="/admin/dashboard"; desc="Dashboard"; category="Admin"},
    @{path="/admin/settings"; desc="Settings"; category="Admin"},
    @{path="/admin/users"; desc="User Management"; category="Admin"},
    @{path="/admin/modules"; desc="Module Config"; category="Admin"},
    @{path="/admin/branding"; desc="Branding"; category="Admin"},
    @{path="/admin/restaurant"; desc="Restaurant Admin"; category="Admin"},
    @{path="/admin/pool"; desc="Pool Admin"; category="Admin"},
    @{path="/admin/chalets"; desc="Chalets Admin"; category="Admin"},
    @{path="/admin/loyalty"; desc="Loyalty Admin"; category="Admin"},
    @{path="/admin/inventory"; desc="Inventory"; category="Admin"},
    @{path="/admin/coupons"; desc="Coupons"; category="Admin"},
    @{path="/admin/giftcards"; desc="Gift Cards"; category="Admin"},
    @{path="/admin/staff"; desc="Staff Management"; category="Admin"},
    @{path="/admin/reviews"; desc="Reviews Admin"; category="Admin"},
    @{path="/admin/integrations"; desc="Integrations"; category="Admin"},
    @{path="/admin/integrations/stripe"; desc="Stripe Integration"; category="Admin"},
    @{path="/admin/integrations/quickbooks"; desc="QuickBooks"; category="Admin"},
    @{path="/admin/integrations/channels"; desc="Channel Manager"; category="Admin"},
    @{path="/admin/housekeeping"; desc="Housekeeping"; category="Admin"},
    @{path="/admin/support"; desc="Support Tickets"; category="Admin"},
    @{path="/admin/gdpr"; desc="GDPR/Privacy"; category="Admin"},
    @{path="/admin/cms"; desc="CMS Editor"; category="Admin"},
    @{path="/admin/cms/homepage"; desc="Homepage CMS"; category="Admin"},
    @{path="/admin/cms/navbar"; desc="Navbar CMS"; category="Admin"},
    @{path="/admin/cms/footer"; desc="Footer CMS"; category="Admin"},
    @{path="/admin/terminology"; desc="Terminology"; category="Admin"},
    @{path="/admin/translations"; desc="Translations"; category="Admin"},
    
    # POS Pages
    @{path="/pos"; desc="POS System"; category="POS"},
    @{path="/pos/restaurant"; desc="Restaurant POS"; category="POS"},
    @{path="/kiosk"; desc="Self-Service Kiosk"; category="Kiosk"},
    
    # Manager Pages
    @{path="/manager"; desc="Manager Portal"; category="Manager"},
    @{path="/manager/approvals"; desc="Approvals"; category="Manager"},
    @{path="/manager/shifts"; desc="Shift Management"; category="Manager"},
    
    # Staff Pages
    @{path="/staff"; desc="Staff Portal"; category="Staff"},
    @{path="/staff/shifts"; desc="My Shifts"; category="Staff"},
    @{path="/staff/tasks"; desc="My Tasks"; category="Staff"}
)

$results = @()
$categories = @{}

foreach ($page in $pages) {
    $url = "$base$($page.path)"
    $code = curl.exe -s -o NUL -w "%{http_code}" $url
    
    $icon = if ($code -eq "200") { "OK" } elseif ($code -eq "401" -or $code -eq "302") { "AUTH" } else { "FAIL" }
    
    $results += [PSCustomObject]@{
        Status = $icon
        Code = $code
        Path = $page.path
        Description = $page.desc
        Category = $page.category
    }
    
    if (-not $categories.ContainsKey($page.category)) {
        $categories[$page.category] = @{ok=0; total=0}
    }
    $categories[$page.category].total++
    if ($code -eq "200" -or $code -eq "302") {
        $categories[$page.category].ok++
    }
    
    Write-Host "$icon`t$code`t$($page.path)"
}

# Save detailed results
$results | Format-Table -AutoSize | Out-File -FilePath "frontend-audit-results.txt" -Encoding UTF8

Write-Host ""
Write-Host "SUMMARY BY CATEGORY:" -ForegroundColor Cyan
foreach ($cat in $categories.Keys | Sort-Object) {
    $c = $categories[$cat]
    Write-Host "  $cat`: $($c.ok)/$($c.total) working"
}

$totalOK = ($results | Where-Object { $_.Code -eq "200" -or $_.Code -eq "302" }).Count
Write-Host ""
Write-Host "TOTAL: $totalOK/$($results.Count) pages accessible" -ForegroundColor Green
