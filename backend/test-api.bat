@echo off
setlocal enabledelayedexpansion

echo ============================================= > api-test-results.txt
echo V2 RESORT BACKEND API TEST RESULTS >> api-test-results.txt
echo ============================================= >> api-test-results.txt
echo Base URL: http://localhost:3005 >> api-test-results.txt
echo Test Time: %date% %time% >> api-test-results.txt
echo. >> api-test-results.txt

echo === PUBLIC ENDPOINTS === >> api-test-results.txt

echo. >> api-test-results.txt
echo 1. GET /health >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" http://localhost:3005/health >> api-test-results.txt

echo. >> api-test-results.txt
echo 2. GET /api/health >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" http://localhost:3005/api/health >> api-test-results.txt

echo. >> api-test-results.txt
echo 3. GET /api/settings >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" http://localhost:3005/api/settings >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 4. GET /api/modules >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" http://localhost:3005/api/modules >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 5. GET /api/v1/pool/sessions >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" http://localhost:3005/api/v1/pool/sessions >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 6. GET /api/v1/restaurant/menu >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" "http://localhost:3005/api/v1/restaurant/menu" >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 7. GET /api/v1/chalets >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" http://localhost:3005/api/v1/chalets >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo === AUTH ENDPOINT === >> api-test-results.txt
echo. >> api-test-results.txt
echo POST /api/v1/auth/login >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -X POST -H "Content-Type: application/json" -d "{\"email\":\"admin@v2resort.com\",\"password\":\"admin123\"}" http://localhost:3005/api/v1/auth/login > auth-response.txt
type auth-response.txt >> api-test-results.txt

echo. >> api-test-results.txt
echo === PROTECTED ENDPOINTS (with token) === >> api-test-results.txt

REM Extract token using PowerShell
for /f "delims=" %%i in ('powershell -Command "(Get-Content auth-response.txt | ConvertFrom-Json).token"') do set TOKEN=%%i

echo Token: %TOKEN:~0,50%... >> api-test-results.txt
echo. >> api-test-results.txt

echo 1. GET /api/v1/users >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/users >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 2. GET /api/v1/staff >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/staff >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 3. GET /api/v1/inventory >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/inventory >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 4. GET /api/v1/admin/settings >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/admin/settings >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 5. GET /api/v1/finance/summary >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/finance/summary >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 6. GET /api/v1/reporting/dashboard >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/reporting/dashboard >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 7. GET /api/v1/loyalty/programs >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/loyalty/programs >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 8. GET /api/v1/coupons >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/coupons >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 9. GET /api/v1/giftcards >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/giftcards >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo 10. GET /api/v1/support/tickets >> api-test-results.txt
curl.exe -s -w "\n   HTTP Status: %%{http_code}\n" -H "Authorization: Bearer %TOKEN%" http://localhost:3005/api/v1/support/tickets >> api-test-results.txt 2>&1

echo. >> api-test-results.txt
echo ============================================= >> api-test-results.txt
echo TEST COMPLETE >> api-test-results.txt
echo ============================================= >> api-test-results.txt

type api-test-results.txt
