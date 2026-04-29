# Admin Wiring Validation

Generated: 2026-04-29T09:44:09.271Z

## Sector Summary

| Sector | Total Endpoints | Missing Paths | Missing Methods | Security Mismatches |
|---|---:|---:|---:|---:|
| Audit Logs | 1 | 1 | 0 | 0 |
| Core Shell | 3 | 1 | 0 | 0 |
| Dynamic Module Admin | 57 | 28 | 4 | 1 |
| Integrations | 9 | 9 | 0 | 0 |
| Marketing & Loyalty & Codes | 21 | 6 | 2 | 0 |
| Misc | 24 | 10 | 0 | 0 |
| Operations | 19 | 0 | 0 | 0 |
| Reports & Finance | 12 | 8 | 0 | 0 |
| Reviews | 4 | 0 | 0 | 0 |
| Settings | 43 | 41 | 0 | 0 |
| Users | 12 | 0 | 0 | 0 |

## Issues

### MISSING_PATH

- Sector: `Audit Logs`
- Page: `/admin/audit`
- Endpoint: `GET /admin/audit-logs`
- Details: No OpenAPI path matches shape: /admin/audit-logs

### MISSING_PATH

- Sector: `Core Shell`
- Page: `/admin/orders`
- Endpoint: `GET /restaurant/admin/orders`
- Details: No OpenAPI path matches shape: /restaurant/admin/orders

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/calendar`
- Endpoint: `POST /chalets/admin/chalets/{selectedChaletId}/block-dates`
- Details: No OpenAPI path matches shape: /chalets/admin/chalets/{}/block-dates

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/calendar`
- Endpoint: `GET /chalets/admin/chalets/{selectedChaletId}/calendar`
- Details: No OpenAPI path matches shape: /chalets/admin/chalets/{}/calendar

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/calendar`
- Endpoint: `POST /chalets/admin/chalets/{selectedChaletId}/unblock-dates`
- Details: No OpenAPI path matches shape: /chalets/admin/chalets/{}/unblock-dates

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/capacity`
- Endpoint: `POST /pool/admin/capacity`
- Details: No OpenAPI path matches shape: /pool/admin/capacity

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/capacity`
- Endpoint: `POST /pool/admin/capacity/reset`
- Details: No OpenAPI path matches shape: /pool/admin/capacity/reset

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/capacity`
- Endpoint: `GET /pool/capacity`
- Details: No OpenAPI path matches shape: /pool/capacity

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/categories`
- Endpoint: `POST /restaurant/admin/categories`
- Details: No OpenAPI path matches shape: /restaurant/admin/categories

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/categories`
- Endpoint: `PUT /restaurant/admin/categories/{id}`
- Details: No OpenAPI path matches shape: /restaurant/admin/categories/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/categories`
- Endpoint: `DELETE /restaurant/admin/categories/{id}`
- Details: No OpenAPI path matches shape: /restaurant/admin/categories/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/categories`
- Endpoint: `GET /restaurant/categories`
- Details: No OpenAPI path matches shape: /restaurant/categories

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/menu`
- Endpoint: `POST /restaurant/admin/items`
- Details: No OpenAPI path matches shape: /restaurant/admin/items

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/menu`
- Endpoint: `PUT /restaurant/admin/items/{id}`
- Details: No OpenAPI path matches shape: /restaurant/admin/items/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/menu`
- Endpoint: `DELETE /restaurant/admin/items/{id}`
- Details: No OpenAPI path matches shape: /restaurant/admin/items/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/menu`
- Endpoint: `GET /restaurant/categories`
- Details: No OpenAPI path matches shape: /restaurant/categories

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/menu`
- Endpoint: `GET /restaurant/customization-groups`
- Details: No OpenAPI path matches shape: /restaurant/customization-groups

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/menu`
- Endpoint: `GET /restaurant/items`
- Details: No OpenAPI path matches shape: /restaurant/items

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/modifiers`
- Endpoint: `POST /restaurant/modifiers/{selectedGroupId}/options`
- Details: No OpenAPI path matches shape: /restaurant/modifiers/{}/options

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/modifiers`
- Endpoint: `PUT /restaurant/modifiers/options/{id}`
- Details: No OpenAPI path matches shape: /restaurant/modifiers/options/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/modifiers`
- Endpoint: `DELETE /restaurant/modifiers/options/{optionId}`
- Details: No OpenAPI path matches shape: /restaurant/modifiers/options/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/pricing`
- Endpoint: `PUT /chalets/admin/price-rules/{id}`
- Details: No OpenAPI path matches shape: /chalets/admin/price-rules/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/pricing`
- Endpoint: `DELETE /chalets/admin/price-rules/{id}`
- Details: No OpenAPI path matches shape: /chalets/admin/price-rules/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/reservations`
- Endpoint: `PATCH /restaurant/reservations/{id}`
- Details: No OpenAPI path matches shape: /restaurant/reservations/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/reservations`
- Endpoint: `POST /restaurant/reservations/{reservationId}/assign-table`
- Details: No OpenAPI path matches shape: /restaurant/reservations/{}/assign-table

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/sessions`
- Endpoint: `POST /pool/admin/sessions`
- Details: No OpenAPI path matches shape: /pool/admin/sessions

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/sessions`
- Endpoint: `PUT /pool/admin/sessions/{id}`
- Details: No OpenAPI path matches shape: /pool/admin/sessions/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/sessions`
- Endpoint: `DELETE /pool/admin/sessions/{id}`
- Details: No OpenAPI path matches shape: /pool/admin/sessions/{}

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/tables`
- Endpoint: `POST /restaurant/admin/tables`
- Details: No OpenAPI path matches shape: /restaurant/admin/tables

### MISSING_PATH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/tables`
- Endpoint: `DELETE /restaurant/admin/tables/{id}`
- Details: No OpenAPI path matches shape: /restaurant/admin/tables/{}

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `GET /integrations/quickbooks/{connectionId}/accounts`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/{}/accounts

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `POST /integrations/quickbooks/{connectionId}/disconnect`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/{}/disconnect

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `GET /integrations/quickbooks/{connectionId}/mappings`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/{}/mappings

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `POST /integrations/quickbooks/{connectionId}/mappings`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/{}/mappings

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `PATCH /integrations/quickbooks/{connectionId}/settings`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/{}/settings

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `POST /integrations/quickbooks/{connectionId}/sync`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/{}/sync

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `GET /integrations/quickbooks/{connectionId}/sync/history`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/{}/sync/history

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `POST /integrations/quickbooks/connect`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/connect

### MISSING_PATH

- Sector: `Integrations`
- Page: `/admin/integrations/quickbooks`
- Endpoint: `GET /integrations/quickbooks/status`
- Details: No OpenAPI path matches shape: /integrations/quickbooks/status

### MISSING_PATH

- Sector: `Marketing & Loyalty & Codes`
- Page: `/admin/giftcards`
- Endpoint: `GET /giftcards/admin`
- Details: No OpenAPI path matches shape: /giftcards/admin

### MISSING_PATH

- Sector: `Marketing & Loyalty & Codes`
- Page: `/admin/giftcards`
- Endpoint: `POST /giftcards/admin`
- Details: No OpenAPI path matches shape: /giftcards/admin

### MISSING_PATH

- Sector: `Marketing & Loyalty & Codes`
- Page: `/admin/giftcards`
- Endpoint: `PUT /giftcards/admin/{cardId}/disable`
- Details: No OpenAPI path matches shape: /giftcards/admin/{}/disable

### MISSING_PATH

- Sector: `Marketing & Loyalty & Codes`
- Page: `/admin/giftcards`
- Endpoint: `GET /giftcards/admin/stats`
- Details: No OpenAPI path matches shape: /giftcards/admin/stats

### MISSING_PATH

- Sector: `Marketing & Loyalty & Codes`
- Page: `/admin/loyalty`
- Endpoint: `GET /csrf-token`
- Details: No OpenAPI path matches shape: /csrf-token

### MISSING_PATH

- Sector: `Marketing & Loyalty & Codes`
- Page: `/admin/loyalty`
- Endpoint: `POST /loyalty/accounts/{id}/adjust`
- Details: No OpenAPI path matches shape: /loyalty/accounts/{}/adjust

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/channels`
- Endpoint: `POST /channels/connections/{channelId}/sync/availability`
- Details: No OpenAPI path matches shape: /channels/connections/{}/sync/availability

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/customizations`
- Endpoint: `GET /customizations/dual-write/stats`
- Details: No OpenAPI path matches shape: /customizations/dual-write/stats

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/customizations`
- Endpoint: `GET /customizations/metrics`
- Details: No OpenAPI path matches shape: /customizations/metrics

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/customizations`
- Endpoint: `POST /customizations/migrate`
- Details: No OpenAPI path matches shape: /customizations/migrate

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/kiosk`
- Endpoint: `DELETE /kiosk/devices/{deviceId}`
- Details: No OpenAPI path matches shape: /kiosk/devices/{}

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/kiosk`
- Endpoint: `POST /kiosk/devices/{deviceId}/maintenance`
- Details: No OpenAPI path matches shape: /kiosk/devices/{}/maintenance

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/kiosk`
- Endpoint: `POST /kiosk/devices/{propertyId}`
- Details: No OpenAPI path matches shape: /kiosk/devices/{}

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/kiosk`
- Endpoint: `GET /kiosk/devices/property/{propertyId}`
- Details: No OpenAPI path matches shape: /kiosk/devices/property/{}

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/kiosk`
- Endpoint: `POST /kiosk/key-stock/{kioskId}/refill`
- Details: No OpenAPI path matches shape: /kiosk/key-stock/{}/refill

### MISSING_PATH

- Sector: `Misc`
- Page: `/admin/properties`
- Endpoint: `POST /multi-property/properties`
- Details: No OpenAPI path matches shape: /multi-property/properties

### MISSING_PATH

- Sector: `Reports & Finance`
- Page: `/admin/reports`
- Endpoint: `GET /admin/reports/customers`
- Details: No OpenAPI path matches shape: /admin/reports/customers

### MISSING_PATH

- Sector: `Reports & Finance`
- Page: `/admin/reports`
- Endpoint: `GET /admin/reports/export`
- Details: No OpenAPI path matches shape: /admin/reports/export

### MISSING_PATH

- Sector: `Reports & Finance`
- Page: `/admin/reports`
- Endpoint: `GET /admin/reports/occupancy`
- Details: No OpenAPI path matches shape: /admin/reports/occupancy

### MISSING_PATH

- Sector: `Reports & Finance`
- Page: `/admin/reports`
- Endpoint: `GET /admin/reports/overview`
- Details: No OpenAPI path matches shape: /admin/reports/overview

### MISSING_PATH

- Sector: `Reports & Finance`
- Page: `/admin/reports/analytics`
- Endpoint: `GET /reports/export-comprehensive`
- Details: No OpenAPI path matches shape: /reports/export-comprehensive

### MISSING_PATH

- Sector: `Reports & Finance`
- Page: `/admin/reports/scheduled`
- Endpoint: `PUT /reporting/scheduled/{id}`
- Details: No OpenAPI path matches shape: /reporting/scheduled/{}

### MISSING_PATH

- Sector: `Reports & Finance`
- Page: `/admin/reports/scheduled`
- Endpoint: `DELETE /reporting/scheduled/{id}`
- Details: No OpenAPI path matches shape: /reporting/scheduled/{}

### MISSING_PATH

- Sector: `Reports & Finance`
- Page: `/admin/reports/scheduled`
- Endpoint: `POST /reporting/scheduled/{id}/run`
- Details: No OpenAPI path matches shape: /reporting/scheduled/{}/run

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings`
- Endpoint: `PUT /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/appearance`
- Endpoint: `PUT /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/backups`
- Endpoint: `GET /admin/backups`
- Details: No OpenAPI path matches shape: /admin/backups

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/backups`
- Endpoint: `POST /admin/backups`
- Details: No OpenAPI path matches shape: /admin/backups

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/backups`
- Endpoint: `DELETE /admin/backups/{id}`
- Details: No OpenAPI path matches shape: /admin/backups/{}

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/backups`
- Endpoint: `GET /admin/backups/{id}/download`
- Details: No OpenAPI path matches shape: /admin/backups/{}/download

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/backups`
- Endpoint: `POST /admin/backups/restore`
- Details: No OpenAPI path matches shape: /admin/backups/restore

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/footer`
- Endpoint: `GET /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/footer`
- Endpoint: `PUT /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/homepage`
- Endpoint: `GET /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/homepage`
- Endpoint: `GET /admin/settings/homepage`
- Details: No OpenAPI path matches shape: /admin/settings/homepage

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/homepage`
- Endpoint: `PUT /admin/settings/homepage`
- Details: No OpenAPI path matches shape: /admin/settings/homepage

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/homepage`
- Endpoint: `POST /admin/uploads`
- Details: No OpenAPI path matches shape: /admin/uploads

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/navbar`
- Endpoint: `GET /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/navbar`
- Endpoint: `PUT /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `GET /admin/notifications`
- Details: No OpenAPI path matches shape: /admin/notifications

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `DELETE /admin/notifications/{id}`
- Details: No OpenAPI path matches shape: /admin/notifications/{}

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `POST /admin/notifications/broadcast`
- Details: No OpenAPI path matches shape: /admin/notifications/broadcast

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `GET /admin/notifications/broadcasts`
- Details: No OpenAPI path matches shape: /admin/notifications/broadcasts

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `POST /admin/notifications/delete-multiple`
- Details: No OpenAPI path matches shape: /admin/notifications/delete-multiple

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `GET /admin/notifications/templates`
- Details: No OpenAPI path matches shape: /admin/notifications/templates

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `POST /admin/notifications/templates`
- Details: No OpenAPI path matches shape: /admin/notifications/templates

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `PUT /admin/notifications/templates/{id}`
- Details: No OpenAPI path matches shape: /admin/notifications/templates/{}

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `DELETE /admin/notifications/templates/{id}`
- Details: No OpenAPI path matches shape: /admin/notifications/templates/{}

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/notifications`
- Endpoint: `POST /admin/notifications/templates/{id}/send`
- Details: No OpenAPI path matches shape: /admin/notifications/templates/{}/send

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/payments`
- Endpoint: `GET /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/payments`
- Endpoint: `PUT /admin/settings`
- Details: No OpenAPI path matches shape: /admin/settings

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/tax`
- Endpoint: `GET /admin/settings/tax`
- Details: No OpenAPI path matches shape: /admin/settings/tax

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/tax`
- Endpoint: `PUT /admin/settings/tax`
- Details: No OpenAPI path matches shape: /admin/settings/tax

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `PUT /admin/translations/{table}/{id}`
- Details: No OpenAPI path matches shape: /admin/translations/{}/{}

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `POST /admin/translations/auto-translate`
- Details: No OpenAPI path matches shape: /admin/translations/auto-translate

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `POST /admin/translations/batch-translate`
- Details: No OpenAPI path matches shape: /admin/translations/batch-translate

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `GET /admin/translations/frontend/compare`
- Details: No OpenAPI path matches shape: /admin/translations/frontend/compare

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `POST /admin/translations/frontend/update`
- Details: No OpenAPI path matches shape: /admin/translations/frontend/update

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `GET /admin/translations/languages`
- Details: No OpenAPI path matches shape: /admin/translations/languages

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `POST /admin/translations/languages`
- Details: No OpenAPI path matches shape: /admin/translations/languages

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `DELETE /admin/translations/languages/{code}`
- Details: No OpenAPI path matches shape: /admin/translations/languages/{}

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `PUT /admin/translations/languages/{code}`
- Details: No OpenAPI path matches shape: /admin/translations/languages/{}

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `GET /admin/translations/missing`
- Details: No OpenAPI path matches shape: /admin/translations/missing

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `GET /admin/translations/stats`
- Details: No OpenAPI path matches shape: /admin/translations/stats

### MISSING_PATH

- Sector: `Settings`
- Page: `/admin/settings/translations`
- Endpoint: `GET /admin/translations/status`
- Details: No OpenAPI path matches shape: /admin/translations/status

### MISSING_METHOD

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/orders`
- Endpoint: `PUT /restaurant/staff/orders/{orderId}/status`
- Details: OpenAPI has path(s) for shape /restaurant/staff/orders/{}/status but no PUT operation.
- Candidates: /restaurant/staff/orders/{id}/status

### MISSING_METHOD

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/pricing`
- Endpoint: `POST /chalets/admin/price-rules`
- Details: OpenAPI has path(s) for shape /chalets/admin/price-rules but no POST operation.
- Candidates: /chalets/admin/price-rules

### MISSING_METHOD

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/reservations`
- Endpoint: `POST /restaurant/reservations`
- Details: OpenAPI has path(s) for shape /restaurant/reservations but no POST operation.
- Candidates: /restaurant/reservations

### MISSING_METHOD

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/waitlist`
- Endpoint: `PATCH /restaurant/waitlist/{id}`
- Details: OpenAPI has path(s) for shape /restaurant/waitlist/{} but no PATCH operation.
- Candidates: /restaurant/waitlist/{id}

### MISSING_METHOD

- Sector: `Marketing & Loyalty & Codes`
- Page: `/admin/loyalty`
- Endpoint: `POST /loyalty/tiers`
- Details: OpenAPI has path(s) for shape /loyalty/tiers but no POST operation.
- Candidates: /loyalty/tiers

### MISSING_METHOD

- Sector: `Marketing & Loyalty & Codes`
- Page: `/admin/loyalty`
- Endpoint: `DELETE /loyalty/tiers/{id}`
- Details: OpenAPI has path(s) for shape /loyalty/tiers/{} but no DELETE operation.
- Candidates: /loyalty/tiers/{tierId}

### SECURITY_MISMATCH

- Sector: `Dynamic Module Admin`
- Page: `/admin/[slug]/waitlist`
- Endpoint: `POST /restaurant/waitlist`
- Details: OpenAPI operation exists at /restaurant/waitlist but has no security requirement.

