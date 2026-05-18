# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ |
| Older branches | ❌ |

Only the latest code on `main` receives security fixes. If you are running a forked or older version, please update before reporting.

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing [alessandro.abisafi@gmail.com](mailto:alessandro.abisafi@gmail.com) with the subject line:

```
[SECURITY] <brief description>
```

### What to include

- A clear description of the vulnerability
- Steps to reproduce (proof-of-concept code or request/response examples if applicable)
- The potential impact and attack surface
- Any suggested fix, if you have one

### What to expect

- **Acknowledgement** within 48 hours
- **Assessment and triage** within 5 business days
- **Fix or mitigation** timeline communicated once triage is complete
- Credit in the release notes if you wish (please let us know your preferred name/handle)

We treat all reports seriously. Even if the issue turns out to be low severity, we appreciate the report.

---

## Scope

The following are **in scope** for security reports:

- Authentication and authorisation bypasses (JWT, RBAC, RLS policies)
- SQL injection or database access control issues
- Cross-site scripting (XSS) in the frontend or admin panel
- Server-side request forgery (SSRF)
- Sensitive data exposure (customer PII, payment data, API credentials)
- Privilege escalation between roles (customer → staff → admin → super_admin)
- Insecure direct object reference (IDOR) on any API endpoint
- Rate limiting or denial-of-service vulnerabilities in production endpoints

The following are **out of scope**:

- Vulnerabilities in dependencies that are already publicly known and tracked in Dependabot alerts
- Issues only reproducible with physical access to the server
- Social engineering attacks
- Theoretical vulnerabilities without a working proof-of-concept

---

## Security Architecture Notes

For contributors and auditors, key security touchpoints in this codebase:

- **RBAC**: `backend/src/config/permissions.ts` — role definitions and permission guards
- **RLS**: `supabase/migrations/` — all tables have Row Level Security policies
- **JWT**: Token rotation is handled in the auth middleware
- **GDPR**: Deletion scheduler and consent management in `backend/src/services/gdpr.service.ts`
- **API key storage**: Encrypted at rest — do not revert to plain base64 encoding
- **Audit logging**: All staff data access is logged via middleware
