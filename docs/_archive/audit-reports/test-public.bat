@echo off
setlocal EnableDelayedExpansion

echo === V2 HOSPITALITY PLATFORM API AUDIT ===
echo Testing all endpoints...
echo.

set BASE=http://localhost:3005
set OUTPUT=api-test-output.txt

echo PUBLIC ENDPOINTS > %OUTPUT%
echo ================ >> %OUTPUT%

for %%e in (
    "/health"
    "/api/health"
    "/api/settings"
    "/api/modules"
    "/api/weather"
    "/api/v1"
    "/api/v1/units"
    "/api/v1/facilities/sessions"
    "/api/v1/dining/menu"
    "/api/v1/terminology"
    "/api/v1/restaurant/menu"
    "/api/v1/restaurant/menu/categories"
    "/api/v1/pool/sessions"
    "/api/v1/chalets"
    "/api/v1/loyalty/settings"
    "/api/v1/loyalty/tiers"
    "/api/v1/reviews"
) do (
    curl -s -o nul -w "%%{http_code} %%e" %BASE%%%~e
    echo.
) >> %OUTPUT%

echo Testing complete. Results in %OUTPUT%
