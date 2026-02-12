/**
 * Comprehensive OpenAPI 3.0.3 Specification for Iron Paradise Gym API
 * 
 * Covers ALL route groups registered in the application.
 * Generated as part of Phase 4: API Documentation remediation.
 * 
 * Access Swagger UI at: /api/docs/ui
 * Access raw spec at:   /api/docs/spec.json
 */

import type { OpenAPIV3 } from 'openapi-types';

// ─── Reusable component definitions ──────────────────────────────────────────

const bearerAuth: OpenAPIV3.SecuritySchemeObject = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT access token obtained from /auth/login or /auth/refresh',
};

const paginationParams: OpenAPIV3.ParameterObject[] = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 }, description: 'Page number' },
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, description: 'Items per page' },
];

const idParam = (entity: string): OpenAPIV3.ParameterObject => ({
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description: `${entity} ID`,
});

const successWrap = (dataSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: dataSchema,
  },
});

const listWrap = (itemRef: string): OpenAPIV3.SchemaObject => successWrap({
  type: 'array',
  items: { $ref: `#/components/schemas/${itemRef}` },
});

// ─── Shared response refs ────────────────────────────────────────────────────

const responses: Record<string, OpenAPIV3.ResponseObject> = {
  BadRequest: { description: 'Validation error or malformed request' },
  Unauthorized: { description: 'Missing or invalid authentication token' },
  Forbidden: { description: 'Insufficient permissions' },
  NotFound: { description: 'Resource not found' },
  Conflict: { description: 'Resource conflict (e.g. duplicate)' },
  RateLimit: { description: 'Rate limit exceeded — retry after X-RateLimit-Reset' },
  ServerError: { description: 'Internal server error' },
};

// ─── Helper to build a standard CRUD tag block ──────────────────────────────

function jsonBody(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): OpenAPIV3.RequestBodyObject {
  return { required: true, content: { 'application/json': { schema } } };
}

function jsonResponse(desc: string, schema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): OpenAPIV3.ResponseObject {
  if (!schema) return { description: desc };
  return { description: desc, content: { 'application/json': { schema } } };
}

const secured: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];

// ─── Full specification ──────────────────────────────────────────────────────

export const openApiFullSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Iron Paradise Gym Management API',
    version: '1.1.0',
    description: `
# Iron Paradise Gym Management System — Full API Reference

Comprehensive REST API for managing all resort operations: accommodation, dining, pool/facilities, loyalty, payments, staff, marketing, GDPR, channel management, and more.

## Base URL
All endpoints are served under \`/api/v1\`.

## Authentication
Most endpoints require a JWT Bearer token:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`
- **Access Token** validity: 15 min
- **Refresh Token** validity: 7 days
- Use \`POST /auth/refresh\` before expiry

## Rate Limiting
| Scope | Limit |
|---|---|
| General | 1 000 req / min |
| Auth | 10 req / 15 min |
| Write operations | 60 req / min |
| Sensitive (refunds) | 10 req / min |

Headers: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

## Standard Response Envelope
\`\`\`json
{ "success": true, "data": { ... }, "message": "optional" }
\`\`\`

### Error Envelope
\`\`\`json
{ "success": false, "error": "Human message", "code": "ERROR_CODE", "requestId": "uuid" }
\`\`\`
`,
    contact: { name: 'Iron Paradise Gym API Support', email: 'api-support@ironparadisegym.com' },
    license: { name: 'Proprietary' },
  },

  servers: [
    { url: '/api/v1', description: 'API v1 (primary)' },
    { url: '/api', description: 'Legacy (use v1 for new integrations)' },
  ],

  // ── Tags ────────────────────────────────────────────────────────────────────
  tags: [
    { name: 'Health', description: 'Liveness & readiness probes' },
    { name: 'Auth', description: 'Registration, login, OAuth, 2FA, biometric auth' },
    { name: 'Users', description: 'User profile, data export, GDPR self-service' },
    { name: 'Restaurant', description: 'Menu, categories, orders, tables, reservations' },
    { name: 'Restaurant Modifiers', description: 'Modifier groups for menu items' },
    { name: 'Restaurant Waitlist', description: 'Waitlist management' },
    { name: 'Snack Bar', description: 'Snack bar menu, orders' },
    { name: 'Chalets', description: 'Chalet listings, bookings, add-ons, pricing' },
    { name: 'Pool', description: 'Pool sessions, tickets, bracelets, maintenance' },
    { name: 'Payments', description: 'Stripe intents, cash, transactions, refunds' },
    { name: 'Finance', description: 'Cash drawer open/close/transactions' },
    { name: 'Loyalty', description: 'Points, tiers, earn/redeem/adjust' },
    { name: 'Gift Cards', description: 'Templates, purchase, redeem, balance check' },
    { name: 'Coupons', description: 'Validate, apply, CRUD coupons' },
    { name: 'Promotions', description: 'Unified coupons, gift-cards & loyalty ops' },
    { name: 'Housekeeping', description: 'Tasks, schedules, staff assignment' },
    { name: 'Inventory', description: 'Items, categories, transactions, alerts' },
    { name: 'Admin', description: 'Dashboard, user mgmt, roles, permissions, settings, modules' },
    { name: 'Manager', description: 'Approvals, shifts, scheduling' },
    { name: 'Staff', description: 'Shifts, assignments, time tracking, swap requests' },
    { name: 'Support', description: 'Contact form, FAQ' },
    { name: 'Reviews', description: 'Customer reviews, moderation' },
    { name: 'Devices', description: 'Push notification device registration' },
    { name: 'Reports', description: 'Executive overview, sales, customer intelligence and exports' },
    { name: 'Reporting', description: 'Report templates, execution, scheduling, KPIs' },
    { name: 'Revenue', description: 'Forecasts, pricing rules, calendar, recommendations' },
    { name: 'POS', description: 'POS terminal, printers, cash drawers' },
    { name: 'GDPR', description: 'Privacy dashboard, export/deletion requests, consents' },
    { name: 'Channels', description: 'OTA channel connections, room/rate mappings, sync' },
    { name: 'Rate Parity', description: 'Parity checks, alerts, dashboards' },
    { name: 'Multi-Property', description: 'Property groups, benchmarks, access control' },
    { name: 'Groups', description: 'Group bookings & event management' },
    { name: 'Marketing', description: 'Campaigns, email tracking, segments, automations' },
    { name: 'Mobile Check-in', description: 'Self-service check-in/out, ID verification' },
    { name: 'Kiosk', description: 'Kiosk sessions, ordering, payments' },
    { name: 'Messaging', description: 'Guest messaging, templates, broadcasts' },
    { name: 'i18n', description: 'Internationalisation — languages, translations, localisation' },
    { name: 'Terminology', description: 'White-label terminology customisation' },
    { name: 'Translations', description: 'Translation strings for UI localisation' },
    { name: 'Customizations', description: 'Unified customization system for all modules' },
    { name: 'Generic (White-Label)', description: 'Generic /units, /facilities, /dining routes' },
    { name: 'Settings', description: 'Public settings, tax config' },
  ],

  // ── Paths ───────────────────────────────────────────────────────────────────
  paths: {

    // ═══════════════════════════════════════════════════════════════════════════
    // HEALTH
    // ═══════════════════════════════════════════════════════════════════════════
    '/health': {
      get: {
        tags: ['Health'],
        operationId: 'healthCheck',
        summary: 'Basic liveness probe',
        responses: { '200': jsonResponse('Server is alive', { type: 'object', properties: { status: { type: 'string', example: 'ok' }, timestamp: { type: 'string', format: 'date-time' } } }) },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        operationId: 'readinessCheck',
        summary: 'Readiness probe (checks database)',
        responses: {
          '200': jsonResponse('Healthy', { type: 'object', properties: { status: { type: 'string' }, database: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, latency: { type: 'string', example: '12ms' } } }, version: { type: 'string' }, uptime: { type: 'number' } } }),
          '503': jsonResponse('Unhealthy'),
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════════════════════════
    '/auth/register': {
      post: {
        tags: ['Auth'], operationId: 'register', summary: 'Register new user',
        requestBody: jsonBody({ type: 'object', required: ['email', 'password', 'fullName'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, fullName: { type: 'string' }, phone: { type: 'string' } } }),
        responses: { '201': jsonResponse('Registered', { $ref: '#/components/schemas/AuthResponse' }), '400': responses.BadRequest, '409': responses.Conflict },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], operationId: 'login', summary: 'User login',
        requestBody: jsonBody({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } }),
        responses: { '200': jsonResponse('Login OK / 2FA required', { $ref: '#/components/schemas/AuthResponse' }), '401': responses.Unauthorized },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'], operationId: 'refreshToken', summary: 'Refresh access token',
        requestBody: jsonBody({ type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } }),
        responses: { '200': jsonResponse('Tokens refreshed', { $ref: '#/components/schemas/AuthResponse' }), '401': responses.Unauthorized },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'], operationId: 'forgotPassword', summary: 'Request password reset email',
        requestBody: jsonBody({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }),
        responses: { '200': jsonResponse('Reset email sent') },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'], operationId: 'resetPassword', summary: 'Reset password with token',
        requestBody: jsonBody({ type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } } }),
        responses: { '200': jsonResponse('Password reset'), '400': responses.BadRequest },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'], operationId: 'getCurrentUser', summary: 'Get current user profile',
        security: secured,
        responses: { '200': jsonResponse('User profile', { $ref: '#/components/schemas/User' }), '401': responses.Unauthorized },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'], operationId: 'logout', summary: 'Logout (invalidate tokens)',
        security: secured,
        responses: { '200': jsonResponse('Logged out') },
      },
    },
    '/auth/change-password': {
      put: {
        tags: ['Auth'], operationId: 'changePassword', summary: 'Change password (authenticated)',
        security: secured,
        requestBody: jsonBody({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } } }),
        responses: { '200': jsonResponse('Password changed'), '400': responses.BadRequest, '401': responses.Unauthorized },
      },
    },
    '/auth/google': { get: { tags: ['Auth'], operationId: 'googleAuth', summary: 'Initiate Google OAuth', responses: { '302': { description: 'Redirect to Google' } } } },
    '/auth/google/callback': { get: { tags: ['Auth'], operationId: 'googleCallback', summary: 'Google OAuth callback', responses: { '200': jsonResponse('Auth tokens') } } },
    '/auth/facebook': { get: { tags: ['Auth'], operationId: 'facebookAuth', summary: 'Initiate Facebook OAuth', responses: { '302': { description: 'Redirect to Facebook' } } } },
    '/auth/facebook/callback': { get: { tags: ['Auth'], operationId: 'facebookCallback', summary: 'Facebook OAuth callback', responses: { '200': jsonResponse('Auth tokens') } } },
    '/auth/apple': { get: { tags: ['Auth'], operationId: 'appleAuth', summary: 'Initiate Apple OAuth', responses: { '302': { description: 'Redirect to Apple' } } } },
    '/auth/apple/callback': { post: { tags: ['Auth'], operationId: 'appleCallback', summary: 'Apple OAuth callback (POST)', responses: { '200': jsonResponse('Auth tokens') } } },
    '/auth/2fa/verify': { post: { tags: ['Auth'], operationId: 'verify2fa', summary: 'Verify 2FA code', requestBody: jsonBody({ type: 'object', required: ['code', 'challengeId'], properties: { code: { type: 'string' }, challengeId: { type: 'string' } } }), responses: { '200': jsonResponse('Verified', { $ref: '#/components/schemas/AuthResponse' }), '401': responses.Unauthorized } } },
    '/auth/2fa/status': { get: { tags: ['Auth'], operationId: 'get2faStatus', summary: 'Get 2FA status', security: secured, responses: { '200': jsonResponse('2FA status') } } },
    '/auth/2fa/setup': { post: { tags: ['Auth'], operationId: 'setup2fa', summary: 'Initialise 2FA setup (returns QR)', security: secured, responses: { '200': jsonResponse('QR code + secret') } } },
    '/auth/2fa/enable': { post: { tags: ['Auth'], operationId: 'enable2fa', summary: 'Confirm & enable 2FA', security: secured, requestBody: jsonBody({ type: 'object', required: ['code'], properties: { code: { type: 'string' } } }), responses: { '200': jsonResponse('2FA enabled') } } },
    '/auth/2fa/disable': { post: { tags: ['Auth'], operationId: 'disable2fa', summary: 'Disable 2FA', security: secured, requestBody: jsonBody({ type: 'object', required: ['code'], properties: { code: { type: 'string' } } }), responses: { '200': jsonResponse('2FA disabled') } } },
    '/auth/biometric/authenticate-begin': { post: { tags: ['Auth'], operationId: 'biometricBegin', summary: 'Begin biometric authentication', responses: { '200': jsonResponse('Challenge') } } },
    '/auth/biometric/authenticate-complete': { post: { tags: ['Auth'], operationId: 'biometricComplete', summary: 'Complete biometric authentication', responses: { '200': jsonResponse('Auth tokens') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // USERS
    // ═══════════════════════════════════════════════════════════════════════════
    '/users/profile': {
      get: { tags: ['Users'], operationId: 'getProfile', summary: 'Get own profile', security: secured, responses: { '200': jsonResponse('Profile', { $ref: '#/components/schemas/User' }) } },
      put: { tags: ['Users'], operationId: 'updateProfile', summary: 'Update own profile', security: secured, requestBody: jsonBody({ type: 'object', properties: { fullName: { type: 'string' }, phone: { type: 'string' }, avatar: { type: 'string' } } }), responses: { '200': jsonResponse('Updated profile') } },
    },
    '/users/me/data': {
      get: { tags: ['Users'], operationId: 'exportUserData', summary: 'Export own data (GDPR)', security: secured, responses: { '200': jsonResponse('Data export') } },
      delete: { tags: ['Users'], operationId: 'deleteUserData', summary: 'Request data deletion (GDPR)', security: secured, responses: { '200': jsonResponse('Deletion requested') } },
    },
    '/users/me/data/portable': { post: { tags: ['Users'], operationId: 'getPortableData', summary: 'Get portable data (GDPR)', security: secured, responses: { '200': jsonResponse('Portable data') } } },
    '/users': { get: { tags: ['Users'], operationId: 'listUsers', summary: 'List users (admin)', security: secured, parameters: [...paginationParams, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: { '200': jsonResponse('User list', listWrap('User')) } } },
    '/users/{id}': { get: { tags: ['Users'], operationId: 'getUserById', summary: 'Get user by ID (admin)', security: secured, parameters: [idParam('User')], responses: { '200': jsonResponse('User', { $ref: '#/components/schemas/User' }), '404': responses.NotFound } } },
    '/users/{id}/roles': { put: { tags: ['Users'], operationId: 'updateUserRoles', summary: 'Update user roles (super_admin)', security: secured, parameters: [idParam('User')], requestBody: jsonBody({ type: 'object', properties: { roles: { type: 'array', items: { type: 'string' } } } }), responses: { '200': jsonResponse('Roles updated') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // RESTAURANT
    // ═══════════════════════════════════════════════════════════════════════════
    '/restaurant/menu': { get: { tags: ['Restaurant'], operationId: 'getMenu', summary: 'Get full menu', parameters: [{ name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'dietary', in: 'query', schema: { type: 'string' } }], responses: { '200': jsonResponse('Menu', listWrap('MenuItem')) } } },
    '/restaurant/menu/categories': { get: { tags: ['Restaurant'], operationId: 'getMenuCategories', summary: 'Get menu categories', responses: { '200': jsonResponse('Categories') } } },
    '/restaurant/menu/items': { get: { tags: ['Restaurant'], operationId: 'getMenuItems', summary: 'Get menu items', responses: { '200': jsonResponse('Items', listWrap('MenuItem')) } } },
    '/restaurant/menu/items/{id}': { get: { tags: ['Restaurant'], operationId: 'getMenuItem', summary: 'Get single menu item', parameters: [idParam('MenuItem')], responses: { '200': jsonResponse('Item', { $ref: '#/components/schemas/MenuItem' }) } } },
    '/restaurant/menu/featured': { get: { tags: ['Restaurant'], operationId: 'getFeaturedItems', summary: 'Get featured items', responses: { '200': jsonResponse('Featured') } } },
    '/restaurant/orders': {
      post: { tags: ['Restaurant'], operationId: 'createOrder', summary: 'Create order', requestBody: jsonBody({ $ref: '#/components/schemas/CreateOrder' }), responses: { '201': jsonResponse('Created', { $ref: '#/components/schemas/Order' }), '400': responses.BadRequest } },
    },
    '/restaurant/my-orders': { get: { tags: ['Restaurant'], operationId: 'getMyOrders', summary: 'Get own orders', security: secured, responses: { '200': jsonResponse('Orders') } } },
    '/restaurant/staff/orders': { get: { tags: ['Restaurant'], operationId: 'getStaffOrders', summary: 'Get orders (staff)', security: secured, parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'] } }, ...paginationParams], responses: { '200': jsonResponse('Orders') } } },
    '/restaurant/staff/orders/live': { get: { tags: ['Restaurant'], operationId: 'getLiveOrders', summary: 'Live orders feed (staff)', security: secured, responses: { '200': jsonResponse('Live orders') } } },
    '/restaurant/staff/orders/{id}/status': { patch: { tags: ['Restaurant'], operationId: 'updateOrderStatus', summary: 'Update order status (staff)', security: secured, parameters: [idParam('Order')], requestBody: jsonBody({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'] } } }), responses: { '200': jsonResponse('Updated'), '404': responses.NotFound } } },
    '/restaurant/tables': { get: { tags: ['Restaurant'], operationId: 'getTables', summary: 'Get tables', responses: { '200': jsonResponse('Tables') } } },
    '/restaurant/tables/available': { get: { tags: ['Restaurant'], operationId: 'getAvailableTables', summary: 'Get available tables', responses: { '200': jsonResponse('Available tables') } } },
    '/restaurant/staff/tables': { get: { tags: ['Restaurant'], operationId: 'getStaffTables', summary: 'Get tables (staff)', security: secured, responses: { '200': jsonResponse('Tables') } } },
    '/restaurant/staff/tables/{id}': { patch: { tags: ['Restaurant'], operationId: 'updateTable', summary: 'Update table (staff)', security: secured, parameters: [idParam('Table')], responses: { '200': jsonResponse('Updated') } } },
    '/restaurant/reservations': { get: { tags: ['Restaurant'], operationId: 'getReservations', summary: 'List reservations (staff)', security: secured, responses: { '200': jsonResponse('Reservations') } } },
    '/restaurant/reservations/availability': { get: { tags: ['Restaurant'], operationId: 'getReservationAvailability', summary: 'Check reservation availability', responses: { '200': jsonResponse('Availability') } } },

    // ── Restaurant Modifiers ─────────────────────────────────────────────────
    '/restaurant/modifiers': {
      get: { tags: ['Restaurant Modifiers'], operationId: 'getModifierGroups', summary: 'List modifier groups', responses: { '200': jsonResponse('Modifier groups') } },
      post: { tags: ['Restaurant Modifiers'], operationId: 'createModifierGroup', summary: 'Create modifier group (admin)', security: secured, requestBody: jsonBody({ type: 'object', required: ['name'], properties: { name: { type: 'string' }, options: { type: 'array', items: { type: 'object' } } } }), responses: { '201': jsonResponse('Created') } },
    },
    '/restaurant/modifiers/{id}': {
      put: { tags: ['Restaurant Modifiers'], operationId: 'updateModifierGroup', summary: 'Update modifier group (admin)', security: secured, parameters: [idParam('ModifierGroup')], responses: { '200': jsonResponse('Updated') } },
      delete: { tags: ['Restaurant Modifiers'], operationId: 'deleteModifierGroup', summary: 'Delete modifier group (admin)', security: secured, parameters: [idParam('ModifierGroup')], responses: { '200': jsonResponse('Deleted') } },
    },

    // ── Restaurant Waitlist ──────────────────────────────────────────────────
    '/restaurant/waitlist': {
      get: { tags: ['Restaurant Waitlist'], operationId: 'getWaitlist', summary: 'Get current waitlist', responses: { '200': jsonResponse('Waitlist entries') } },
      post: { tags: ['Restaurant Waitlist'], operationId: 'joinWaitlist', summary: 'Join waitlist', requestBody: jsonBody({ type: 'object', required: ['partyName', 'partySize'], properties: { partyName: { type: 'string' }, partySize: { type: 'integer' }, phone: { type: 'string' } } }), responses: { '201': jsonResponse('Entry created') } },
    },
    '/restaurant/waitlist/join': { post: { tags: ['Restaurant Waitlist'], operationId: 'joinWaitlistAlt', summary: 'Join waitlist (alias)', requestBody: jsonBody({ type: 'object', required: ['partyName', 'partySize'], properties: { partyName: { type: 'string' }, partySize: { type: 'integer' } } }), responses: { '201': jsonResponse('Entry created') } } },
    '/restaurant/waitlist/{id}': {
      get: { tags: ['Restaurant Waitlist'], operationId: 'getWaitlistEntry', summary: 'Get waitlist entry', parameters: [idParam('WaitlistEntry')], responses: { '200': jsonResponse('Entry') } },
      delete: { tags: ['Restaurant Waitlist'], operationId: 'removeFromWaitlist', summary: 'Remove from waitlist (staff)', security: secured, parameters: [idParam('WaitlistEntry')], responses: { '200': jsonResponse('Removed') } },
    },
    '/restaurant/waitlist/{id}/status': { patch: { tags: ['Restaurant Waitlist'], operationId: 'updateWaitlistStatus', summary: 'Update waitlist entry status (staff)', security: secured, parameters: [idParam('WaitlistEntry')], responses: { '200': jsonResponse('Updated') } } },
    '/restaurant/waitlist/{id}/notify': { post: { tags: ['Restaurant Waitlist'], operationId: 'notifyWaitlistEntry', summary: 'Notify guest from waitlist (staff)', security: secured, parameters: [idParam('WaitlistEntry')], responses: { '200': jsonResponse('Notified') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // SNACK BAR
    // ═══════════════════════════════════════════════════════════════════════════
    '/snack/categories': { get: { tags: ['Snack Bar'], operationId: 'getSnackCategories', summary: 'Get snack categories', responses: { '200': jsonResponse('Categories') } } },
    '/snack/items': { get: { tags: ['Snack Bar'], operationId: 'getSnackItems', summary: 'Get snack items', responses: { '200': jsonResponse('Items') } } },
    '/snack/items/{id}': { get: { tags: ['Snack Bar'], operationId: 'getSnackItem', summary: 'Get single snack item', parameters: [idParam('SnackItem')], responses: { '200': jsonResponse('Item') } } },
    '/snack/orders': { post: { tags: ['Snack Bar'], operationId: 'createSnackOrder', summary: 'Create snack order', requestBody: jsonBody({ type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object' } } } }), responses: { '201': jsonResponse('Created') } } },
    '/snack/orders/my': { get: { tags: ['Snack Bar'], operationId: 'getMySnackOrders', summary: 'Get own snack orders', security: secured, responses: { '200': jsonResponse('Orders') } } },
    '/snack/orders/{id}': { get: { tags: ['Snack Bar'], operationId: 'getSnackOrder', summary: 'Get single snack order', parameters: [idParam('SnackOrder')], responses: { '200': jsonResponse('Order') } } },
    '/snack/orders/{id}/status': { get: { tags: ['Snack Bar'], operationId: 'getSnackOrderStatus', summary: 'Get snack order status', parameters: [idParam('SnackOrder')], responses: { '200': jsonResponse('Status') } } },
    '/snack/staff/orders': { get: { tags: ['Snack Bar'], operationId: 'getSnackStaffOrders', summary: 'Get orders (staff)', security: secured, responses: { '200': jsonResponse('Orders') } } },
    '/snack/staff/orders/live': { get: { tags: ['Snack Bar'], operationId: 'getSnackLiveOrders', summary: 'Live snack orders (staff)', security: secured, responses: { '200': jsonResponse('Live orders') } } },
    '/snack/staff/orders/{id}/status': { patch: { tags: ['Snack Bar'], operationId: 'updateSnackOrderStatus', summary: 'Update snack order status (staff)', security: secured, parameters: [idParam('SnackOrder')], responses: { '200': jsonResponse('Updated') } } },
    '/snack/admin/categories': { post: { tags: ['Snack Bar'], operationId: 'createSnackCategory', summary: 'Create snack category (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/snack/admin/categories/{id}': {
      put: { tags: ['Snack Bar'], operationId: 'updateSnackCategory', summary: 'Update snack category (admin)', security: secured, parameters: [idParam('Category')], responses: { '200': jsonResponse('Updated') } },
      delete: { tags: ['Snack Bar'], operationId: 'deleteSnackCategory', summary: 'Delete snack category (admin)', security: secured, parameters: [idParam('Category')], responses: { '200': jsonResponse('Deleted') } },
    },
    '/snack/admin/items': { post: { tags: ['Snack Bar'], operationId: 'createSnackItem', summary: 'Create snack item (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/snack/admin/items/{id}': {
      put: { tags: ['Snack Bar'], operationId: 'updateSnackItem', summary: 'Update snack item (admin)', security: secured, parameters: [idParam('SnackItem')], responses: { '200': jsonResponse('Updated') } },
      delete: { tags: ['Snack Bar'], operationId: 'deleteSnackItem', summary: 'Delete snack item (admin)', security: secured, parameters: [idParam('SnackItem')], responses: { '200': jsonResponse('Deleted') } },
    },
    '/snack/admin/items/{id}/availability': { patch: { tags: ['Snack Bar'], operationId: 'toggleSnackAvailability', summary: 'Toggle snack item availability (admin)', security: secured, parameters: [idParam('SnackItem')], responses: { '200': jsonResponse('Toggled') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // CHALETS
    // ═══════════════════════════════════════════════════════════════════════════
    '/chalets': { get: { tags: ['Chalets'], operationId: 'getChalets', summary: 'List chalets', responses: { '200': jsonResponse('Chalets', listWrap('Chalet')) } } },
    '/chalets/{id}': { get: { tags: ['Chalets'], operationId: 'getChalet', summary: 'Get single chalet', parameters: [idParam('Chalet')], responses: { '200': jsonResponse('Chalet', { $ref: '#/components/schemas/Chalet' }) } } },
    '/chalets/{id}/availability': { get: { tags: ['Chalets'], operationId: 'getChaletAvailability', summary: 'Check chalet availability', parameters: [idParam('Chalet'), { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } }, { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } }], responses: { '200': jsonResponse('Availability') } } },
    '/chalets/add-ons': { get: { tags: ['Chalets'], operationId: 'getAddOns', summary: 'Get chalet add-ons', responses: { '200': jsonResponse('Add-ons') } } },
    '/chalets/bookings': { post: { tags: ['Chalets'], operationId: 'createBooking', summary: 'Create chalet booking', requestBody: jsonBody({ $ref: '#/components/schemas/CreateBooking' }), responses: { '201': jsonResponse('Booking created'), '400': responses.BadRequest, '409': responses.Conflict } } },
    '/chalets/bookings/{id}': { get: { tags: ['Chalets'], operationId: 'getBooking', summary: 'Get single booking', parameters: [idParam('Booking')], responses: { '200': jsonResponse('Booking') } } },
    '/chalets/bookings/{id}/cancel': { post: { tags: ['Chalets'], operationId: 'cancelBooking', summary: 'Cancel booking', parameters: [idParam('Booking')], responses: { '200': jsonResponse('Cancelled') } } },
    '/chalets/my-bookings': { get: { tags: ['Chalets'], operationId: 'getMyBookings', summary: 'Get own bookings', security: secured, responses: { '200': jsonResponse('Bookings') } } },
    '/chalets/staff/bookings': { get: { tags: ['Chalets'], operationId: 'getStaffBookings', summary: 'Get bookings (staff)', security: secured, responses: { '200': jsonResponse('Bookings') } } },
    '/chalets/staff/bookings/today': { get: { tags: ['Chalets'], operationId: 'getTodayBookings', summary: 'Get today bookings (staff)', security: secured, responses: { '200': jsonResponse('Bookings') } } },
    '/chalets/staff/bookings/{id}/check-in': { patch: { tags: ['Chalets'], operationId: 'checkIn', summary: 'Check-in guest (staff)', security: secured, parameters: [idParam('Booking')], responses: { '200': jsonResponse('Checked in') } } },
    '/chalets/staff/bookings/{id}/check-out': { patch: { tags: ['Chalets'], operationId: 'checkOut', summary: 'Check-out guest (staff)', security: secured, parameters: [idParam('Booking')], responses: { '200': jsonResponse('Checked out') } } },
    '/chalets/staff/bookings/{id}/status': { patch: { tags: ['Chalets'], operationId: 'updateBookingStatus', summary: 'Update booking status (staff)', security: secured, parameters: [idParam('Booking')], responses: { '200': jsonResponse('Updated') } } },
    '/chalets/admin/chalets': { post: { tags: ['Chalets'], operationId: 'createChalet', summary: 'Create chalet (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/chalets/admin/chalets/{id}': {
      put: { tags: ['Chalets'], operationId: 'updateChalet', summary: 'Update chalet (admin)', security: secured, parameters: [idParam('Chalet')], responses: { '200': jsonResponse('Updated') } },
      delete: { tags: ['Chalets'], operationId: 'deleteChalet', summary: 'Delete chalet (admin)', security: secured, parameters: [idParam('Chalet')], responses: { '200': jsonResponse('Deleted') } },
    },
    '/chalets/admin/add-ons': { get: { tags: ['Chalets'], operationId: 'getAdminAddOns', summary: 'List add-ons (admin)', security: secured, responses: { '200': jsonResponse('Add-ons') } }, post: { tags: ['Chalets'], operationId: 'createAddOn', summary: 'Create add-on (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/chalets/admin/add-ons/{id}': {
      put: { tags: ['Chalets'], operationId: 'updateAddOn', summary: 'Update add-on (admin)', security: secured, parameters: [idParam('AddOn')], responses: { '200': jsonResponse('Updated') } },
      delete: { tags: ['Chalets'], operationId: 'deleteAddOn', summary: 'Delete add-on (admin)', security: secured, parameters: [idParam('AddOn')], responses: { '200': jsonResponse('Deleted') } },
    },
    '/chalets/admin/price-rules': { get: { tags: ['Chalets'], operationId: 'getPriceRules', summary: 'Get price rules (admin)', security: secured, responses: { '200': jsonResponse('Price rules') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // POOL
    // ═══════════════════════════════════════════════════════════════════════════
    '/pool/sessions': { get: { tags: ['Pool'], operationId: 'getPoolSessions', summary: 'Get pool sessions', parameters: [{ name: 'date', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': jsonResponse('Sessions', listWrap('PoolSession')) } } },
    '/pool/sessions/{id}': { get: { tags: ['Pool'], operationId: 'getPoolSession', summary: 'Get single session', parameters: [idParam('Session')], responses: { '200': jsonResponse('Session') } } },
    '/pool/availability': { get: { tags: ['Pool'], operationId: 'getPoolAvailability', summary: 'Get pool availability', responses: { '200': jsonResponse('Availability') } } },
    '/pool/tickets': {
      post: { tags: ['Pool'], operationId: 'purchaseTicket', summary: 'Purchase pool ticket', requestBody: jsonBody({ type: 'object', required: ['sessionId', 'customerName', 'customerEmail'], properties: { sessionId: { type: 'string', format: 'uuid' }, customerName: { type: 'string' }, customerEmail: { type: 'string', format: 'email' }, customerPhone: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 10, default: 1 } } }), responses: { '201': jsonResponse('Ticket purchased'), '400': responses.BadRequest } },
    },
    '/pool/tickets/{id}': {
      get: { tags: ['Pool'], operationId: 'getTicket', summary: 'Get ticket details', parameters: [idParam('Ticket')], responses: { '200': jsonResponse('Ticket') } },
      delete: { tags: ['Pool'], operationId: 'cancelTicket', summary: 'Cancel ticket', security: secured, parameters: [idParam('Ticket')], responses: { '200': jsonResponse('Cancelled') } },
    },
    '/pool/my-tickets': { get: { tags: ['Pool'], operationId: 'getMyTickets', summary: 'Get own tickets', security: secured, responses: { '200': jsonResponse('Tickets') } } },
    '/pool/staff/validate': { post: { tags: ['Pool'], operationId: 'validateTicket', summary: 'Validate ticket (staff)', security: secured, responses: { '200': jsonResponse('Validated') } } },
    '/pool/tickets/{id}/entry': { post: { tags: ['Pool'], operationId: 'recordEntry', summary: 'Record pool entry (staff)', security: secured, parameters: [idParam('Ticket')], responses: { '200': jsonResponse('Entry recorded') } } },
    '/pool/tickets/{id}/exit': { post: { tags: ['Pool'], operationId: 'recordExit', summary: 'Record pool exit (staff)', security: secured, parameters: [idParam('Ticket')], responses: { '200': jsonResponse('Exit recorded') } } },
    '/pool/staff/capacity': { get: { tags: ['Pool'], operationId: 'getCurrentCapacity', summary: 'Get current pool capacity (staff)', security: secured, responses: { '200': jsonResponse('Capacity') } } },
    '/pool/staff/tickets/today': { get: { tags: ['Pool'], operationId: 'getTodayTickets', summary: 'Get today tickets (staff)', security: secured, responses: { '200': jsonResponse('Tickets') } } },
    '/pool/staff/maintenance': {
      get: { tags: ['Pool'], operationId: 'getMaintenanceLogs', summary: 'Get maintenance logs (staff)', security: secured, responses: { '200': jsonResponse('Logs') } },
      post: { tags: ['Pool'], operationId: 'createMaintenanceLog', summary: 'Create maintenance log (staff)', security: secured, responses: { '201': jsonResponse('Created') } },
    },
    '/pool/tickets/{id}/bracelet': {
      post: { tags: ['Pool'], operationId: 'assignBracelet', summary: 'Assign bracelet (staff)', security: secured, parameters: [idParam('Ticket')], responses: { '200': jsonResponse('Assigned') } },
      delete: { tags: ['Pool'], operationId: 'returnBracelet', summary: 'Return bracelet (staff)', security: secured, parameters: [idParam('Ticket')], responses: { '200': jsonResponse('Returned') } },
    },
    '/pool/staff/bracelets/active': { get: { tags: ['Pool'], operationId: 'getActiveBracelets', summary: 'Get active bracelets (staff)', security: secured, responses: { '200': jsonResponse('Bracelets') } } },
    '/pool/staff/bracelets/search': { get: { tags: ['Pool'], operationId: 'searchByBracelet', summary: 'Search by bracelet (staff)', security: secured, responses: { '200': jsonResponse('Results') } } },
    '/pool/settings': { get: { tags: ['Pool'], operationId: 'getPoolSettings', summary: 'Get pool settings', responses: { '200': jsonResponse('Settings') } } },
    '/pool/admin/settings': { put: { tags: ['Pool'], operationId: 'updatePoolSettings', summary: 'Update pool settings (admin)', security: secured, responses: { '200': jsonResponse('Updated') } } },
    '/pool/admin/reset-occupancy': { post: { tags: ['Pool'], operationId: 'resetOccupancy', summary: 'Reset occupancy counter (admin)', security: secured, responses: { '200': jsonResponse('Reset') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // PAYMENTS
    // ═══════════════════════════════════════════════════════════════════════════
    '/payments/webhook/stripe': { post: { tags: ['Payments'], operationId: 'stripeWebhook', summary: 'Stripe webhook handler', responses: { '200': jsonResponse('OK') } } },
    '/payments/create-intent': { post: { tags: ['Payments'], operationId: 'createPaymentIntent', summary: 'Create Stripe payment intent', requestBody: jsonBody({ type: 'object', required: ['amount', 'currency'], properties: { amount: { type: 'integer', description: 'Amount in cents' }, currency: { type: 'string', default: 'usd' }, metadata: { type: 'object' } } }), responses: { '200': jsonResponse('Client secret') } } },
    '/payments/methods': { get: { tags: ['Payments'], operationId: 'getPaymentMethods', summary: 'Get saved payment methods', security: secured, responses: { '200': jsonResponse('Methods') } } },
    '/payments/record-cash': { post: { tags: ['Payments'], operationId: 'recordCash', summary: 'Record cash payment (staff)', security: secured, responses: { '201': jsonResponse('Recorded') } } },
    '/payments/record-manual': { post: { tags: ['Payments'], operationId: 'recordManual', summary: 'Record manual payment (staff)', security: secured, responses: { '201': jsonResponse('Recorded') } } },
    '/payments/transactions': { get: { tags: ['Payments'], operationId: 'getTransactions', summary: 'List transactions (admin)', security: secured, parameters: [...paginationParams], responses: { '200': jsonResponse('Transactions') } } },
    '/payments/transactions/{id}': { get: { tags: ['Payments'], operationId: 'getTransaction', summary: 'Get transaction (admin)', security: secured, parameters: [idParam('Transaction')], responses: { '200': jsonResponse('Transaction') } } },
    '/payments/transactions/{id}/refund': { post: { tags: ['Payments'], operationId: 'refundPayment', summary: 'Refund payment (admin)', security: secured, parameters: [idParam('Transaction')], responses: { '200': jsonResponse('Refunded') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // FINANCE
    // ═══════════════════════════════════════════════════════════════════════════
    '/finance/open': { post: { tags: ['Finance'], operationId: 'openDrawer', summary: 'Open cash drawer', security: secured, responses: { '200': jsonResponse('Drawer opened') } } },
    '/finance/close': { post: { tags: ['Finance'], operationId: 'closeDrawer', summary: 'Close cash drawer', security: secured, responses: { '200': jsonResponse('Drawer closed') } } },
    '/finance/transaction': { post: { tags: ['Finance'], operationId: 'recordFinanceTransaction', summary: 'Record drawer transaction', security: secured, responses: { '201': jsonResponse('Recorded') } } },
    '/finance': { get: { tags: ['Finance'], operationId: 'getDrawers', summary: 'Get drawers (admin)', security: secured, responses: { '200': jsonResponse('Drawers') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // LOYALTY
    // ═══════════════════════════════════════════════════════════════════════════
    '/loyalty/calculate': { post: { tags: ['Loyalty'], operationId: 'calculatePoints', summary: 'Calculate points for amount', requestBody: jsonBody({ type: 'object', properties: { amount: { type: 'number' } } }), responses: { '200': jsonResponse('Points') } } },
    '/loyalty/me': { get: { tags: ['Loyalty'], operationId: 'getMyLoyaltyAccount', summary: 'Get own loyalty account', security: secured, responses: { '200': jsonResponse('Account') } } },
    '/loyalty/me/transactions': { get: { tags: ['Loyalty'], operationId: 'getMyLoyaltyTransactions', summary: 'Get own transactions', security: secured, responses: { '200': jsonResponse('Transactions') } } },
    '/loyalty/settings': { get: { tags: ['Loyalty'], operationId: 'getLoyaltySettings', summary: 'Get loyalty settings', responses: { '200': jsonResponse('Settings') } }, put: { tags: ['Loyalty'], operationId: 'updateLoyaltySettings', summary: 'Update loyalty settings (admin)', security: secured, responses: { '200': jsonResponse('Updated') } } },
    '/loyalty/tiers': { get: { tags: ['Loyalty'], operationId: 'getLoyaltyTiers', summary: 'Get loyalty tiers', responses: { '200': jsonResponse('Tiers') } } },
    '/loyalty/tiers/{tierId}': { put: { tags: ['Loyalty'], operationId: 'updateLoyaltyTier', summary: 'Update tier (admin)', security: secured, parameters: [{ name: 'tierId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Updated') } } },
    '/loyalty/accounts': { get: { tags: ['Loyalty'], operationId: 'getAllLoyaltyAccounts', summary: 'List all accounts (admin)', security: secured, responses: { '200': jsonResponse('Accounts') } } },
    '/loyalty/accounts/{userId}': { get: { tags: ['Loyalty'], operationId: 'getLoyaltyAccount', summary: 'Get account by user (admin)', security: secured, parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Account') } } },
    '/loyalty/accounts/{userId}/transactions': { get: { tags: ['Loyalty'], operationId: 'getLoyaltyAccountTransactions', summary: 'Get account transactions (admin)', security: secured, parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Transactions') } } },
    '/loyalty/stats': { get: { tags: ['Loyalty'], operationId: 'getLoyaltyStats', summary: 'Get loyalty stats (admin)', security: secured, responses: { '200': jsonResponse('Stats') } } },
    '/loyalty/earn': { post: { tags: ['Loyalty'], operationId: 'earnPoints', summary: 'Award loyalty points (staff)', security: secured, responses: { '200': jsonResponse('Points earned') } } },
    '/loyalty/redeem': { post: { tags: ['Loyalty'], operationId: 'redeemPoints', summary: 'Redeem loyalty points (staff)', security: secured, responses: { '200': jsonResponse('Points redeemed') } } },
    '/loyalty/adjust': { post: { tags: ['Loyalty'], operationId: 'adjustPoints', summary: 'Adjust points (admin)', security: secured, responses: { '200': jsonResponse('Adjusted') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // GIFT CARDS
    // ═══════════════════════════════════════════════════════════════════════════
    '/giftcards/templates': { get: { tags: ['Gift Cards'], operationId: 'getGiftCardTemplates', summary: 'Get gift card templates', responses: { '200': jsonResponse('Templates') } }, post: { tags: ['Gift Cards'], operationId: 'createGiftCardTemplate', summary: 'Create template (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/giftcards/templates/{id}': { put: { tags: ['Gift Cards'], operationId: 'updateGiftCardTemplate', summary: 'Update template (admin)', security: secured, parameters: [idParam('Template')], responses: { '200': jsonResponse('Updated') } } },
    '/giftcards/check/{code}': { get: { tags: ['Gift Cards'], operationId: 'checkGiftCardBalance', summary: 'Check gift card balance', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': jsonResponse('Balance') } } },
    '/giftcards/purchase': { post: { tags: ['Gift Cards'], operationId: 'purchaseGiftCard', summary: 'Purchase gift card', security: secured, responses: { '201': jsonResponse('Purchased') } } },
    '/giftcards/my': { get: { tags: ['Gift Cards'], operationId: 'getMyGiftCards', summary: 'Get own gift cards', security: secured, responses: { '200': jsonResponse('Gift cards') } } },
    '/giftcards/redeem': { post: { tags: ['Gift Cards'], operationId: 'redeemGiftCard', summary: 'Redeem gift card', security: secured, responses: { '200': jsonResponse('Redeemed') } } },
    '/giftcards': { get: { tags: ['Gift Cards'], operationId: 'getAllGiftCards', summary: 'List all gift cards (admin)', security: secured, responses: { '200': jsonResponse('Gift cards') } }, post: { tags: ['Gift Cards'], operationId: 'createGiftCard', summary: 'Create gift card (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/giftcards/stats': { get: { tags: ['Gift Cards'], operationId: 'getGiftCardStats', summary: 'Get gift card stats (admin)', security: secured, responses: { '200': jsonResponse('Stats') } } },
    '/giftcards/{id}': { get: { tags: ['Gift Cards'], operationId: 'getGiftCard', summary: 'Get gift card (admin)', security: secured, parameters: [idParam('GiftCard')], responses: { '200': jsonResponse('Gift card') } } },
    '/giftcards/{id}/disable': { put: { tags: ['Gift Cards'], operationId: 'disableGiftCard', summary: 'Disable gift card (admin)', security: secured, parameters: [idParam('GiftCard')], responses: { '200': jsonResponse('Disabled') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // COUPONS
    // ═══════════════════════════════════════════════════════════════════════════
    '/coupons/active': { get: { tags: ['Coupons'], operationId: 'getActiveCoupons', summary: 'Get active coupons', responses: { '200': jsonResponse('Coupons') } } },
    '/coupons/validate': { post: { tags: ['Coupons'], operationId: 'validateCoupon', summary: 'Validate a coupon code', requestBody: jsonBody({ type: 'object', required: ['code'], properties: { code: { type: 'string' } } }), responses: { '200': jsonResponse('Validation result') } } },
    '/coupons/apply': { post: { tags: ['Coupons'], operationId: 'applyCoupon', summary: 'Apply coupon to order', security: secured, responses: { '200': jsonResponse('Applied') } } },
    '/coupons': { get: { tags: ['Coupons'], operationId: 'getAllCoupons', summary: 'List all coupons (admin)', security: secured, responses: { '200': jsonResponse('Coupons') } }, post: { tags: ['Coupons'], operationId: 'createCoupon', summary: 'Create coupon (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/coupons/stats': { get: { tags: ['Coupons'], operationId: 'getCouponStats', summary: 'Get coupon stats (admin)', security: secured, responses: { '200': jsonResponse('Stats') } } },
    '/coupons/generate-code': { get: { tags: ['Coupons'], operationId: 'generateCouponCode', summary: 'Generate unique code (admin)', security: secured, responses: { '200': jsonResponse('Code') } } },
    '/coupons/{id}': {
      get: { tags: ['Coupons'], operationId: 'getCoupon', summary: 'Get coupon (admin)', security: secured, parameters: [idParam('Coupon')], responses: { '200': jsonResponse('Coupon') } },
      put: { tags: ['Coupons'], operationId: 'updateCoupon', summary: 'Update coupon (admin)', security: secured, parameters: [idParam('Coupon')], responses: { '200': jsonResponse('Updated') } },
      delete: { tags: ['Coupons'], operationId: 'deleteCoupon', summary: 'Delete coupon (admin)', security: secured, parameters: [idParam('Coupon')], responses: { '200': jsonResponse('Deleted') } },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // PROMOTIONS (Unified)
    // ═══════════════════════════════════════════════════════════════════════════
    '/promotions/coupons/apply': { post: { tags: ['Promotions'], operationId: 'promoApplyCoupon', summary: 'Apply coupon (unified)', security: secured, responses: { '200': jsonResponse('Applied') } } },
    '/promotions/coupons': { post: { tags: ['Promotions'], operationId: 'promoCreateCoupon', summary: 'Create coupon (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/promotions/coupons/abuse-report': { get: { tags: ['Promotions'], operationId: 'promoAbuseReport', summary: 'Coupon abuse report (admin)', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/promotions/gift-cards': { post: { tags: ['Promotions'], operationId: 'promoIssueGiftCard', summary: 'Issue gift card', security: secured, responses: { '201': jsonResponse('Issued') } } },
    '/promotions/gift-cards/{code}/balance': { get: { tags: ['Promotions'], operationId: 'promoGiftCardBalance', summary: 'Check gift card balance', security: secured, parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': jsonResponse('Balance') } } },
    '/promotions/gift-cards/redeem': { post: { tags: ['Promotions'], operationId: 'promoRedeemGiftCard', summary: 'Redeem gift card', security: secured, responses: { '200': jsonResponse('Redeemed') } } },
    '/promotions/gift-cards/liability-report': { get: { tags: ['Promotions'], operationId: 'promoLiabilityReport', summary: 'Gift card liability report (admin)', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/promotions/loyalty/award': { post: { tags: ['Promotions'], operationId: 'promoAwardPoints', summary: 'Award loyalty points (staff)', security: secured, responses: { '200': jsonResponse('Awarded') } } },
    '/promotions/loyalty/redeem': { post: { tags: ['Promotions'], operationId: 'promoRedeemPoints', summary: 'Redeem loyalty points', security: secured, responses: { '200': jsonResponse('Redeemed') } } },
    '/promotions/loyalty/users/{userId}/status': { get: { tags: ['Promotions'], operationId: 'promoUserLoyaltyStatus', summary: 'Get user loyalty status', security: secured, parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Status') } } },
    '/promotions/loyalty/expire-points': { post: { tags: ['Promotions'], operationId: 'promoExpirePoints', summary: 'Expire loyalty points (admin)', security: secured, responses: { '200': jsonResponse('Expired') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // HOUSEKEEPING
    // ═══════════════════════════════════════════════════════════════════════════
    '/housekeeping/task-types': { get: { tags: ['Housekeeping'], operationId: 'getTaskTypes', summary: 'Get task types', security: secured, responses: { '200': jsonResponse('Task types') } } },
    '/housekeeping/my-tasks': { get: { tags: ['Housekeeping'], operationId: 'getMyHousekeepingTasks', summary: 'Get my tasks (staff)', security: secured, responses: { '200': jsonResponse('Tasks') } } },
    '/housekeeping/tasks': { get: { tags: ['Housekeeping'], operationId: 'getHousekeepingTasks', summary: 'List all tasks (admin)', security: secured, responses: { '200': jsonResponse('Tasks') } }, post: { tags: ['Housekeeping'], operationId: 'createHousekeepingTask', summary: 'Create task (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/housekeeping/tasks/{id}': { get: { tags: ['Housekeeping'], operationId: 'getHousekeepingTask', summary: 'Get task', security: secured, parameters: [idParam('Task')], responses: { '200': jsonResponse('Task') } }, put: { tags: ['Housekeeping'], operationId: 'updateHousekeepingTask', summary: 'Update task (admin)', security: secured, parameters: [idParam('Task')], responses: { '200': jsonResponse('Updated') } } },
    '/housekeeping/tasks/{id}/start': { post: { tags: ['Housekeeping'], operationId: 'startHousekeepingTask', summary: 'Start task (staff)', security: secured, parameters: [idParam('Task')], responses: { '200': jsonResponse('Started') } } },
    '/housekeeping/tasks/{id}/complete': { post: { tags: ['Housekeeping'], operationId: 'completeHousekeepingTask', summary: 'Complete task (staff)', security: secured, parameters: [idParam('Task')], responses: { '200': jsonResponse('Completed') } } },
    '/housekeeping/tasks/{id}/issue': { post: { tags: ['Housekeeping'], operationId: 'reportHousekeepingIssue', summary: 'Report issue (staff)', security: secured, parameters: [idParam('Task')], responses: { '200': jsonResponse('Reported') } } },
    '/housekeeping/tasks/{id}/assign': { post: { tags: ['Housekeeping'], operationId: 'assignHousekeepingTask', summary: 'Assign task (admin)', security: secured, parameters: [idParam('Task')], responses: { '200': jsonResponse('Assigned') } } },
    '/housekeeping/schedules': { get: { tags: ['Housekeeping'], operationId: 'getHousekeepingSchedules', summary: 'List schedules (admin)', security: secured, responses: { '200': jsonResponse('Schedules') } }, post: { tags: ['Housekeeping'], operationId: 'createHousekeepingSchedule', summary: 'Create schedule (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/housekeeping/schedules/{id}': { put: { tags: ['Housekeeping'], operationId: 'updateHousekeepingSchedule', summary: 'Update schedule (admin)', security: secured, parameters: [idParam('Schedule')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Housekeeping'], operationId: 'deleteHousekeepingSchedule', summary: 'Delete schedule (admin)', security: secured, parameters: [idParam('Schedule')], responses: { '200': jsonResponse('Deleted') } } },
    '/housekeeping/staff': { get: { tags: ['Housekeeping'], operationId: 'getHousekeepingStaff', summary: 'Get available staff (admin)', security: secured, responses: { '200': jsonResponse('Staff') } } },
    '/housekeeping/stats': { get: { tags: ['Housekeeping'], operationId: 'getHousekeepingStats', summary: 'Get housekeeping stats (admin)', security: secured, responses: { '200': jsonResponse('Stats') } } },
    '/housekeeping/generate-scheduled': { post: { tags: ['Housekeeping'], operationId: 'generateScheduledTasks', summary: 'Generate scheduled tasks (admin)', security: secured, responses: { '200': jsonResponse('Generated') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // INVENTORY
    // ═══════════════════════════════════════════════════════════════════════════
    '/inventory/categories': { get: { tags: ['Inventory'], operationId: 'getInventoryCategories', summary: 'Get categories (staff)', security: secured, responses: { '200': jsonResponse('Categories') } }, post: { tags: ['Inventory'], operationId: 'createInventoryCategory', summary: 'Create category (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/inventory/categories/{id}': { put: { tags: ['Inventory'], operationId: 'updateInventoryCategory', summary: 'Update category (admin)', security: secured, parameters: [idParam('Category')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Inventory'], operationId: 'deleteInventoryCategory', summary: 'Delete category (admin)', security: secured, parameters: [idParam('Category')], responses: { '200': jsonResponse('Deleted') } } },
    '/inventory/items': { get: { tags: ['Inventory'], operationId: 'getInventoryItems', summary: 'List items (staff)', security: secured, responses: { '200': jsonResponse('Items') } }, post: { tags: ['Inventory'], operationId: 'createInventoryItem', summary: 'Create item (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/inventory/items/{id}': { get: { tags: ['Inventory'], operationId: 'getInventoryItem', summary: 'Get item (staff)', security: secured, parameters: [idParam('Item')], responses: { '200': jsonResponse('Item') } }, put: { tags: ['Inventory'], operationId: 'updateInventoryItem', summary: 'Update item (admin)', security: secured, parameters: [idParam('Item')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Inventory'], operationId: 'deleteInventoryItem', summary: 'Delete item (admin)', security: secured, parameters: [idParam('Item')], responses: { '200': jsonResponse('Deleted') } } },
    '/inventory/items/{itemId}/link-menu': { post: { tags: ['Inventory'], operationId: 'linkInventoryToMenu', summary: 'Link to menu item (admin)', security: secured, parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Linked') } } },
    '/inventory/transactions': { get: { tags: ['Inventory'], operationId: 'getInventoryTransactions', summary: 'Get transactions (staff)', security: secured, responses: { '200': jsonResponse('Transactions') } }, post: { tags: ['Inventory'], operationId: 'recordInventoryTransaction', summary: 'Record transaction (staff)', security: secured, responses: { '201': jsonResponse('Recorded') } } },
    '/inventory/transactions/bulk': { post: { tags: ['Inventory'], operationId: 'bulkInventoryTransaction', summary: 'Bulk transaction (admin)', security: secured, responses: { '201': jsonResponse('Recorded') } } },
    '/inventory/alerts': { get: { tags: ['Inventory'], operationId: 'getInventoryAlerts', summary: 'Get inventory alerts (staff)', security: secured, responses: { '200': jsonResponse('Alerts') } } },
    '/inventory/alerts/{id}/resolve': { post: { tags: ['Inventory'], operationId: 'resolveInventoryAlert', summary: 'Resolve alert (staff)', security: secured, parameters: [idParam('Alert')], responses: { '200': jsonResponse('Resolved') } } },
    '/inventory/stats': { get: { tags: ['Inventory'], operationId: 'getInventoryStats', summary: 'Get inventory stats (admin)', security: secured, responses: { '200': jsonResponse('Stats') } } },
    '/inventory/report': { get: { tags: ['Inventory'], operationId: 'getInventoryReport', summary: 'Generate inventory report (admin)', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/inventory/check-expiring': { post: { tags: ['Inventory'], operationId: 'checkExpiringItems', summary: 'Check expiring items (admin)', security: secured, responses: { '200': jsonResponse('Expiring items') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════
    '/admin/modules': { get: { tags: ['Admin'], operationId: 'getModules', summary: 'Get modules', security: secured, responses: { '200': jsonResponse('Modules') } }, post: { tags: ['Admin'], operationId: 'createModule', summary: 'Create module (super_admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/admin/modules/{id}': { get: { tags: ['Admin'], operationId: 'getModule', summary: 'Get module', security: secured, parameters: [idParam('Module')], responses: { '200': jsonResponse('Module') } }, put: { tags: ['Admin'], operationId: 'updateModule', summary: 'Update module', security: secured, parameters: [idParam('Module')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Admin'], operationId: 'deleteModule', summary: 'Delete module', security: secured, parameters: [idParam('Module')], responses: { '200': jsonResponse('Deleted') } } },
    '/admin/dashboard': { get: { tags: ['Admin'], operationId: 'getDashboard', summary: 'Get dashboard stats', security: secured, responses: { '200': jsonResponse('Dashboard') } } },
    '/admin/dashboard/revenue': { get: { tags: ['Admin'], operationId: 'getRevenueStats', summary: 'Get revenue stats', security: secured, responses: { '200': jsonResponse('Revenue') } } },
    '/admin/users': { get: { tags: ['Admin'], operationId: 'adminGetUsers', summary: 'List users (admin)', security: secured, parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['customer', 'staff', 'admin'] } }, ...paginationParams], responses: { '200': jsonResponse('Users') } }, post: { tags: ['Admin'], operationId: 'adminCreateUser', summary: 'Create user (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/admin/users/{id}': { get: { tags: ['Admin'], operationId: 'adminGetUser', summary: 'Get user details (admin)', security: secured, parameters: [idParam('User')], responses: { '200': jsonResponse('User') } }, put: { tags: ['Admin'], operationId: 'adminUpdateUser', summary: 'Update user (admin)', security: secured, parameters: [idParam('User')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Admin'], operationId: 'adminDeleteUser', summary: 'Delete user (super_admin)', security: secured, parameters: [idParam('User')], responses: { '200': jsonResponse('Deleted') } } },
    '/admin/users/{id}/roles': { put: { tags: ['Admin'], operationId: 'adminUpdateUserRoles', summary: 'Update user roles (super_admin)', security: secured, parameters: [idParam('User')], responses: { '200': jsonResponse('Roles updated') } } },
    '/admin/users/{id}/permissions': { put: { tags: ['Admin'], operationId: 'adminUpdateUserPermissions', summary: 'Override user permissions (super_admin)', security: secured, parameters: [idParam('User')], responses: { '200': jsonResponse('Permissions updated') } } },
    '/admin/roles': { get: { tags: ['Admin'], operationId: 'getRoles', summary: 'List roles (super_admin)', security: secured, responses: { '200': jsonResponse('Roles') } }, post: { tags: ['Admin'], operationId: 'createRole', summary: 'Create role (super_admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/admin/roles/{id}': { put: { tags: ['Admin'], operationId: 'updateRole', summary: 'Update role (super_admin)', security: secured, parameters: [idParam('Role')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Admin'], operationId: 'deleteRole', summary: 'Delete role (super_admin)', security: secured, parameters: [idParam('Role')], responses: { '200': jsonResponse('Deleted') } } },
    '/admin/roles/{id}/permissions': { get: { tags: ['Admin'], operationId: 'getRolePermissions', summary: 'Get role permissions', security: secured, parameters: [idParam('Role')], responses: { '200': jsonResponse('Permissions') } }, put: { tags: ['Admin'], operationId: 'updateRolePermissions', summary: 'Update role permissions', security: secured, parameters: [idParam('Role')], responses: { '200': jsonResponse('Updated') } } },
    '/admin/permissions': { get: { tags: ['Admin'], operationId: 'getAllPermissions', summary: 'List all permissions', security: secured, responses: { '200': jsonResponse('Permissions') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // SUPPORT
    // ═══════════════════════════════════════════════════════════════════════════
    '/support/contact': { post: { tags: ['Support'], operationId: 'submitContactForm', summary: 'Submit contact form', requestBody: jsonBody({ type: 'object', required: ['name', 'email', 'message'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, message: { type: 'string' } } }), responses: { '200': jsonResponse('Submitted') } } },
    '/support/faq': { get: { tags: ['Support'], operationId: 'getFaq', summary: 'Get FAQ', responses: { '200': jsonResponse('FAQ items') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // REVIEWS
    // ═══════════════════════════════════════════════════════════════════════════
    '/reviews': { get: { tags: ['Reviews'], operationId: 'getApprovedReviews', summary: 'Get approved reviews', responses: { '200': jsonResponse('Reviews') } }, post: { tags: ['Reviews'], operationId: 'createReview', summary: 'Create review', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/reviews/admin': { get: { tags: ['Reviews'], operationId: 'getAllReviews', summary: 'Get all reviews (admin)', security: secured, responses: { '200': jsonResponse('Reviews') } } },
    '/reviews/{id}/status': { patch: { tags: ['Reviews'], operationId: 'updateReviewStatus', summary: 'Update review status (admin)', security: secured, parameters: [idParam('Review')], responses: { '200': jsonResponse('Updated') } } },
    '/reviews/{id}/approve': { put: { tags: ['Reviews'], operationId: 'approveReview', summary: 'Approve review (admin)', security: secured, parameters: [idParam('Review')], responses: { '200': jsonResponse('Approved') } } },
    '/reviews/{id}/reject': { put: { tags: ['Reviews'], operationId: 'rejectReview', summary: 'Reject review (admin)', security: secured, parameters: [idParam('Review')], responses: { '200': jsonResponse('Rejected') } } },
    '/reviews/{id}': { delete: { tags: ['Reviews'], operationId: 'deleteReview', summary: 'Delete review (admin)', security: secured, parameters: [idParam('Review')], responses: { '200': jsonResponse('Deleted') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // DEVICES
    // ═══════════════════════════════════════════════════════════════════════════
    '/devices/register': { post: { tags: ['Devices'], operationId: 'registerDevice', summary: 'Register device for push notifications', requestBody: jsonBody({ type: 'object', required: ['token', 'platform'], properties: { token: { type: 'string' }, platform: { type: 'string', enum: ['ios', 'android', 'web'] } } }), responses: { '200': jsonResponse('Registered') } } },
    '/devices/unregister': { delete: { tags: ['Devices'], operationId: 'unregisterDevice', summary: 'Unregister device', responses: { '200': jsonResponse('Unregistered') } } },
    '/devices': { get: { tags: ['Devices'], operationId: 'getUserDevices', summary: 'Get user devices', responses: { '200': jsonResponse('Devices') } } },
    '/devices/{deviceId}/preferences': { patch: { tags: ['Devices'], operationId: 'updateDevicePreferences', summary: 'Update device preferences', parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': jsonResponse('Updated') } } },
    '/devices/{deviceId}': { delete: { tags: ['Devices'], operationId: 'removeDevice', summary: 'Remove device', parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': jsonResponse('Removed') } } },
    '/devices/logout-all': { post: { tags: ['Devices'], operationId: 'logoutAllDevices', summary: 'Logout all devices', responses: { '200': jsonResponse('Logged out all') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // MANAGER
    // ═══════════════════════════════════════════════════════════════════════════
    '/manager/approvals': { post: { tags: ['Manager'], operationId: 'createApproval', summary: 'Create approval request', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/manager/shifts/my': { get: { tags: ['Manager'], operationId: 'getManagerMyShifts', summary: 'Get my shifts', security: secured, responses: { '200': jsonResponse('Shifts') } } },
    '/manager/shifts/current': { get: { tags: ['Manager'], operationId: 'getManagerCurrentShift', summary: 'Get current shift', security: secured, responses: { '200': jsonResponse('Shift') } } },
    '/manager/shifts/{id}/clock-in': { post: { tags: ['Manager'], operationId: 'managerClockIn', summary: 'Clock in', security: secured, parameters: [idParam('Shift')], responses: { '200': jsonResponse('Clocked in') } } },
    '/manager/shifts/{id}/clock-out': { post: { tags: ['Manager'], operationId: 'managerClockOut', summary: 'Clock out', security: secured, parameters: [idParam('Shift')], responses: { '200': jsonResponse('Clocked out') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // STAFF
    // ═══════════════════════════════════════════════════════════════════════════
    '/staff/shifts/me': { get: { tags: ['Staff'], operationId: 'getMyShifts', summary: 'Get my shifts', security: secured, responses: { '200': jsonResponse('Shifts') } } },
    '/staff/shifts': { get: { tags: ['Staff'], operationId: 'getAllShifts', summary: 'Get all shifts (manager)', security: secured, responses: { '200': jsonResponse('Shifts') } }, post: { tags: ['Staff'], operationId: 'createShift', summary: 'Create shift (manager)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/staff/shifts/{id}': { put: { tags: ['Staff'], operationId: 'updateShift', summary: 'Update shift (manager)', security: secured, parameters: [idParam('Shift')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Staff'], operationId: 'deleteShift', summary: 'Delete shift (manager)', security: secured, parameters: [idParam('Shift')], responses: { '200': jsonResponse('Deleted') } } },
    '/staff/shifts/{id}/clock-in': { post: { tags: ['Staff'], operationId: 'staffClockIn', summary: 'Clock in', security: secured, parameters: [idParam('Shift')], responses: { '200': jsonResponse('Clocked in') } } },
    '/staff/shifts/{id}/clock-out': { post: { tags: ['Staff'], operationId: 'staffClockOut', summary: 'Clock out', security: secured, parameters: [idParam('Shift')], responses: { '200': jsonResponse('Clocked out') } } },
    '/staff/assignments': { get: { tags: ['Staff'], operationId: 'getStaffAssignments', summary: 'Get assignments (manager)', security: secured, responses: { '200': jsonResponse('Assignments') } } },
    '/staff/assignments/me': { get: { tags: ['Staff'], operationId: 'getMyAssignment', summary: 'Get own assignment', security: secured, responses: { '200': jsonResponse('Assignment') } } },
    '/staff/assignments/bulk': { post: { tags: ['Staff'], operationId: 'bulkAssignStaff', summary: 'Bulk assign (manager)', security: secured, responses: { '200': jsonResponse('Assigned') } } },
    '/staff/shifts/swap': { post: { tags: ['Staff'], operationId: 'requestShiftSwap', summary: 'Request shift swap', security: secured, responses: { '201': jsonResponse('Requested') } }, get: { tags: ['Staff'], operationId: 'getAllSwapRequests', summary: 'Get all swap requests (manager)', security: secured, responses: { '200': jsonResponse('Requests') } } },
    '/staff/shifts/swap/me': { get: { tags: ['Staff'], operationId: 'getMySwapRequests', summary: 'Get own swap requests', security: secured, responses: { '200': jsonResponse('Requests') } } },
    '/staff/shifts/swap/{id}/respond': { put: { tags: ['Staff'], operationId: 'respondToSwapRequest', summary: 'Respond to swap', security: secured, parameters: [idParam('SwapRequest')], responses: { '200': jsonResponse('Responded') } } },
    '/staff/shifts/swap/{id}/approve': { put: { tags: ['Staff'], operationId: 'approveSwapRequest', summary: 'Approve swap (manager)', security: secured, parameters: [idParam('SwapRequest')], responses: { '200': jsonResponse('Approved') } } },
    '/staff/shifts/swap/{id}': { delete: { tags: ['Staff'], operationId: 'cancelSwapRequest', summary: 'Cancel swap', security: secured, parameters: [idParam('SwapRequest')], responses: { '200': jsonResponse('Cancelled') } } },
    '/staff/time-tracking': { get: { tags: ['Staff'], operationId: 'getTimeTrackingReport', summary: 'Get time tracking report (manager)', security: secured, responses: { '200': jsonResponse('Report') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // REPORTS
    // ═══════════════════════════════════════════════════════════════════════════
    '/reports/executive-overview': { get: { tags: ['Reports'], operationId: 'getExecutiveOverview', summary: 'Executive overview report', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/reports/daily-sales': { get: { tags: ['Reports'], operationId: 'getDailySalesReport', summary: 'Daily sales report', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/reports/hourly-metrics': { get: { tags: ['Reports'], operationId: 'getHourlyMetrics', summary: 'Hourly metrics', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/reports/customer-intelligence': { get: { tags: ['Reports'], operationId: 'getCustomerIntelligence', summary: 'Customer intelligence', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/reports/product-performance': { get: { tags: ['Reports'], operationId: 'getProductPerformance', summary: 'Product performance', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/reports/export': { get: { tags: ['Reports'], operationId: 'exportReport', summary: 'Export report data', security: secured, responses: { '200': jsonResponse('Export data') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // REPORTING (Advanced templates/schedules)
    // ═══════════════════════════════════════════════════════════════════════════
    '/reporting/templates': { get: { tags: ['Reporting'], operationId: 'getReportTemplates', summary: 'List report templates', security: secured, responses: { '200': jsonResponse('Templates') } }, post: { tags: ['Reporting'], operationId: 'createReportTemplate', summary: 'Create template (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/reporting/templates/{id}': { get: { tags: ['Reporting'], operationId: 'getReportTemplate', summary: 'Get template', security: secured, parameters: [idParam('Template')], responses: { '200': jsonResponse('Template') } }, put: { tags: ['Reporting'], operationId: 'updateReportTemplate', summary: 'Update template (admin)', security: secured, parameters: [idParam('Template')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Reporting'], operationId: 'deleteReportTemplate', summary: 'Delete template (admin)', security: secured, parameters: [idParam('Template')], responses: { '200': jsonResponse('Deleted') } } },
    '/reporting/execute/{templateId}': { post: { tags: ['Reporting'], operationId: 'executeReport', summary: 'Execute a report', security: secured, parameters: [{ name: 'templateId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Report data') } } },
    '/reporting/kpis': { get: { tags: ['Reporting'], operationId: 'getKPIs', summary: 'Get KPIs', security: secured, responses: { '200': jsonResponse('KPIs') } } },
    '/reporting/financial/revenue': { get: { tags: ['Reporting'], operationId: 'getRevenueReport', summary: 'Revenue report', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/reporting/financial/occupancy': { get: { tags: ['Reporting'], operationId: 'getOccupancyReport', summary: 'Occupancy report', security: secured, responses: { '200': jsonResponse('Report') } } },
    '/reporting/scheduled': { get: { tags: ['Reporting'], operationId: 'getScheduledReports', summary: 'List scheduled reports', security: secured, responses: { '200': jsonResponse('Reports') } }, post: { tags: ['Reporting'], operationId: 'createScheduledReport', summary: 'Create scheduled report (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // REVENUE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════
    '/revenue/forecasts': { get: { tags: ['Revenue'], operationId: 'getForecasts', summary: 'Get forecasts', security: secured, responses: { '200': jsonResponse('Forecasts') } } },
    '/revenue/forecasts/generate': { post: { tags: ['Revenue'], operationId: 'generateForecasts', summary: 'Generate forecasts (admin)', security: secured, responses: { '200': jsonResponse('Generated') } } },
    '/revenue/rules': { get: { tags: ['Revenue'], operationId: 'getPricingRules', summary: 'Get pricing rules', security: secured, responses: { '200': jsonResponse('Rules') } }, post: { tags: ['Revenue'], operationId: 'createPricingRule', summary: 'Create pricing rule (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/revenue/rules/{id}': { put: { tags: ['Revenue'], operationId: 'updatePricingRule', summary: 'Update pricing rule (admin)', security: secured, parameters: [idParam('Rule')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Revenue'], operationId: 'deletePricingRule', summary: 'Delete pricing rule (admin)', security: secured, parameters: [idParam('Rule')], responses: { '200': jsonResponse('Deleted') } } },
    '/revenue/calendar': { get: { tags: ['Revenue'], operationId: 'getPricingCalendar', summary: 'Get pricing calendar', security: secured, responses: { '200': jsonResponse('Calendar') } } },
    '/revenue/recommendations': { get: { tags: ['Revenue'], operationId: 'getRecommendations', summary: 'Get pricing recommendations', security: secured, responses: { '200': jsonResponse('Recommendations') } } },
    '/revenue/events': { get: { tags: ['Revenue'], operationId: 'getMarketEvents', summary: 'Get market events', security: secured, responses: { '200': jsonResponse('Events') } }, post: { tags: ['Revenue'], operationId: 'createMarketEvent', summary: 'Create market event (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // POS HARDWARE
    // ═══════════════════════════════════════════════════════════════════════════
    '/pos/terminal/connection-token': { post: { tags: ['POS'], operationId: 'createConnectionToken', summary: 'Create Stripe terminal connection token', security: secured, responses: { '200': jsonResponse('Token') } } },
    '/pos/terminal/payment-intent': { post: { tags: ['POS'], operationId: 'createTerminalPaymentIntent', summary: 'Create terminal payment intent', security: secured, responses: { '200': jsonResponse('Intent') } } },
    '/pos/terminal/capture': { post: { tags: ['POS'], operationId: 'captureTerminalPayment', summary: 'Capture terminal payment', security: secured, responses: { '200': jsonResponse('Captured') } } },
    '/pos/terminal/cancel': { post: { tags: ['POS'], operationId: 'cancelTerminalPayment', summary: 'Cancel terminal payment', security: secured, responses: { '200': jsonResponse('Cancelled') } } },
    '/pos/terminal/readers': { get: { tags: ['POS'], operationId: 'listReaders', summary: 'List POS readers', security: secured, responses: { '200': jsonResponse('Readers') } }, post: { tags: ['POS'], operationId: 'registerReader', summary: 'Register reader (admin)', security: secured, responses: { '201': jsonResponse('Registered') } } },
    '/pos/print': { post: { tags: ['POS'], operationId: 'printToNetworkPrinter', summary: 'Print receipt', security: secured, responses: { '200': jsonResponse('Printed') } } },
    '/pos/open-drawer': { post: { tags: ['POS'], operationId: 'posOpenCashDrawer', summary: 'Open cash drawer', security: secured, responses: { '200': jsonResponse('Opened') } } },
    '/pos/printer/status': { get: { tags: ['POS'], operationId: 'getPrinterStatus', summary: 'Get printer status', security: secured, responses: { '200': jsonResponse('Status') } } },
    '/pos/printer/config': { get: { tags: ['POS'], operationId: 'getPrinterConfig', summary: 'Get printer config', security: secured, responses: { '200': jsonResponse('Config') } }, post: { tags: ['POS'], operationId: 'savePrinterConfig', summary: 'Save printer config (admin)', security: secured, responses: { '200': jsonResponse('Saved') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // GDPR
    // ═══════════════════════════════════════════════════════════════════════════
    '/gdpr/dashboard': { get: { tags: ['GDPR'], operationId: 'getPrivacyDashboard', summary: 'Get privacy dashboard', security: secured, responses: { '200': jsonResponse('Dashboard') } } },
    '/gdpr/export/request': { post: { tags: ['GDPR'], operationId: 'requestGdprExport', summary: 'Request data export', security: secured, responses: { '200': jsonResponse('Export requested') } } },
    '/gdpr/export/status': { get: { tags: ['GDPR'], operationId: 'getExportStatus', summary: 'Get export status', security: secured, responses: { '200': jsonResponse('Status') } } },
    '/gdpr/export/download/{requestId}': { get: { tags: ['GDPR'], operationId: 'downloadExport', summary: 'Download export', security: secured, parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Download') } } },
    '/gdpr/deletion/request': { post: { tags: ['GDPR'], operationId: 'requestDeletion', summary: 'Request account deletion', security: secured, responses: { '200': jsonResponse('Deletion requested') } } },
    '/gdpr/deletion/status': { get: { tags: ['GDPR'], operationId: 'getDeletionStatus', summary: 'Get deletion status', security: secured, responses: { '200': jsonResponse('Status') } } },
    '/gdpr/consents': { get: { tags: ['GDPR'], operationId: 'getConsents', summary: 'Get consents', security: secured, responses: { '200': jsonResponse('Consents') } }, put: { tags: ['GDPR'], operationId: 'updateConsent', summary: 'Update consent', security: secured, responses: { '200': jsonResponse('Updated') } } },
    '/gdpr/consents/bulk': { put: { tags: ['GDPR'], operationId: 'updateMultipleConsents', summary: 'Bulk update consents', security: secured, responses: { '200': jsonResponse('Updated') } } },
    '/gdpr/processing-log': { get: { tags: ['GDPR'], operationId: 'getProcessingLog', summary: 'Get processing log', security: secured, responses: { '200': jsonResponse('Log') } } },
    '/gdpr/data-sharing': { get: { tags: ['GDPR'], operationId: 'getDataSharingLog', summary: 'Get data sharing log', security: secured, responses: { '200': jsonResponse('Log') } } },
    '/gdpr/admin/retention-policies': { get: { tags: ['GDPR'], operationId: 'getRetentionPolicies', summary: 'Get retention policies (admin)', security: secured, responses: { '200': jsonResponse('Policies') } } },
    '/gdpr/admin/retention-policies/{policyId}': { put: { tags: ['GDPR'], operationId: 'updateRetentionPolicy', summary: 'Update retention policy (admin)', security: secured, parameters: [{ name: 'policyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Updated') } } },
    '/gdpr/admin/deletion-requests': { get: { tags: ['GDPR'], operationId: 'listDeletionRequests', summary: 'List deletion requests (admin)', security: secured, responses: { '200': jsonResponse('Requests') } } },
    '/gdpr/admin/deletion-requests/{requestId}/approve': { post: { tags: ['GDPR'], operationId: 'approveDeletion', summary: 'Approve deletion (admin)', security: secured, parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Approved') } } },
    '/gdpr/admin/deletion-requests/{requestId}/reject': { post: { tags: ['GDPR'], operationId: 'rejectDeletion', summary: 'Reject deletion (admin)', security: secured, parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Rejected') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // CHANNELS
    // ═══════════════════════════════════════════════════════════════════════════
    '/channels/properties/{propertyId}/connections': { get: { tags: ['Channels'], operationId: 'getChannelConnections', summary: 'Get channel connections', security: secured, parameters: [{ name: 'propertyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Connections') } }, post: { tags: ['Channels'], operationId: 'createChannelConnection', summary: 'Create channel connection', security: secured, parameters: [{ name: 'propertyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '201': jsonResponse('Created') } } },
    '/channels/connections/{connectionId}': { get: { tags: ['Channels'], operationId: 'getChannelConnection', summary: 'Get connection', security: secured, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Connection') } }, delete: { tags: ['Channels'], operationId: 'deleteChannelConnection', summary: 'Delete connection', security: secured, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Deleted') } } },
    '/channels/connections/{connectionId}/activate': { post: { tags: ['Channels'], operationId: 'activateChannel', summary: 'Activate connection', security: secured, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Activated') } } },
    '/channels/connections/{connectionId}/pause': { post: { tags: ['Channels'], operationId: 'pauseChannel', summary: 'Pause connection', security: secured, parameters: [{ name: 'connectionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Paused') } } },
    '/channels/sync/all': { post: { tags: ['Channels'], operationId: 'triggerFullSync', summary: 'Trigger full sync', security: secured, responses: { '200': jsonResponse('Sync triggered') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // RATE PARITY
    // ═══════════════════════════════════════════════════════════════════════════
    '/rate-parity/properties/{propertyId}/config': { get: { tags: ['Rate Parity'], operationId: 'getParityConfig', summary: 'Get rate parity config', security: secured, parameters: [{ name: 'propertyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Config') } }, put: { tags: ['Rate Parity'], operationId: 'updateParityConfig', summary: 'Update rate parity config', security: secured, parameters: [{ name: 'propertyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Updated') } } },
    '/rate-parity/properties/{propertyId}/check': { post: { tags: ['Rate Parity'], operationId: 'runParityCheck', summary: 'Run parity check', security: secured, parameters: [{ name: 'propertyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Results') } } },
    '/rate-parity/properties/{propertyId}/dashboard': { get: { tags: ['Rate Parity'], operationId: 'getParityDashboard', summary: 'Get parity dashboard', security: secured, parameters: [{ name: 'propertyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': jsonResponse('Dashboard') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // MULTI-PROPERTY
    // ═══════════════════════════════════════════════════════════════════════════
    '/multi-property/my-properties': { get: { tags: ['Multi-Property'], operationId: 'getMyProperties', summary: 'Get own properties', security: secured, responses: { '200': jsonResponse('Properties') } } },
    '/multi-property/switch-property': { post: { tags: ['Multi-Property'], operationId: 'switchProperty', summary: 'Switch active property', security: secured, responses: { '200': jsonResponse('Switched') } } },
    '/multi-property/groups': { get: { tags: ['Multi-Property'], operationId: 'getPropertyGroups', summary: 'Get property groups (admin)', security: secured, responses: { '200': jsonResponse('Groups') } }, post: { tags: ['Multi-Property'], operationId: 'createPropertyGroup', summary: 'Create property group (super_admin)', security: secured, responses: { '201': jsonResponse('Created') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // GROUPS (Group Bookings)
    // ═══════════════════════════════════════════════════════════════════════════
    '/groups': { post: { tags: ['Groups'], operationId: 'createGroup', summary: 'Create group booking', security: secured, responses: { '201': jsonResponse('Created') } }, get: { tags: ['Groups'], operationId: 'listGroups', summary: 'List group bookings', security: secured, responses: { '200': jsonResponse('Groups') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // MARKETING
    // ═══════════════════════════════════════════════════════════════════════════
    '/marketing/track/open/{sendId}': { get: { tags: ['Marketing'], operationId: 'trackEmailOpen', summary: 'Track email open', parameters: [{ name: 'sendId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': jsonResponse('Tracked') } } },
    '/marketing/track/click/{sendId}': { get: { tags: ['Marketing'], operationId: 'trackEmailClick', summary: 'Track email click', parameters: [{ name: 'sendId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': jsonResponse('Tracked') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // MOBILE CHECK-IN
    // ═══════════════════════════════════════════════════════════════════════════
    '/mobile-checkin': { post: { tags: ['Mobile Check-in'], operationId: 'startMobileCheckin', summary: 'Start mobile check-in', security: secured, responses: { '200': jsonResponse('Check-in started') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // KIOSK
    // ═══════════════════════════════════════════════════════════════════════════
    '/kiosk': { post: { tags: ['Kiosk'], operationId: 'startKioskSession', summary: 'Start kiosk session', security: secured, responses: { '200': jsonResponse('Session started') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGING
    // ═══════════════════════════════════════════════════════════════════════════
    '/messaging': { post: { tags: ['Messaging'], operationId: 'sendMessage', summary: 'Send guest message', security: secured, responses: { '200': jsonResponse('Sent') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // I18N
    // ═══════════════════════════════════════════════════════════════════════════
    '/i18n': { post: { tags: ['i18n'], operationId: 'addLanguage', summary: 'Add supported language (admin)', security: secured, responses: { '201': jsonResponse('Added') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // TERMINOLOGY (White-Label)
    // ═══════════════════════════════════════════════════════════════════════════
    '/terminology': {
      get: { tags: ['Terminology'], operationId: 'getTerminology', summary: 'Get active terminology', responses: { '200': jsonResponse('Terminology', { $ref: '#/components/schemas/Terminology' }) } },
      post: { tags: ['Terminology'], operationId: 'updateTerminology', summary: 'Update terminology (admin)', security: secured, requestBody: jsonBody({ type: 'object', properties: { unit_singular: { type: 'string' }, unit_plural: { type: 'string' }, facility_singular: { type: 'string' }, facility_plural: { type: 'string' } } }), responses: { '200': jsonResponse('Updated') } },
    },
    '/terminology/admin': { get: { tags: ['Terminology'], operationId: 'getTerminologyAdmin', summary: 'Get all terminology (admin)', security: secured, responses: { '200': jsonResponse('Terminology') } } },
    '/terminology/bulk': { post: { tags: ['Terminology'], operationId: 'bulkUpdateTerminology', summary: 'Bulk update terminology (admin)', security: secured, responses: { '200': jsonResponse('Updated') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSLATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    '/translations': {
      get: { tags: ['Translations'], operationId: 'getTranslations', summary: 'Get translations', parameters: [{ name: 'lang', in: 'query', schema: { type: 'string' }, description: 'Language code' }], responses: { '200': jsonResponse('Translations') } },
      post: { tags: ['Translations'], operationId: 'createTranslation', summary: 'Create/update translation (admin)', security: secured, responses: { '200': jsonResponse('Saved') } },
    },
    '/translations/{namespace}': { get: { tags: ['Translations'], operationId: 'getTranslationNamespace', summary: 'Get translations by namespace', parameters: [{ name: 'namespace', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': jsonResponse('Translations') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // CUSTOMIZATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    '/customizations/groups': { get: { tags: ['Customizations'], operationId: 'getCustomizationGroups', summary: 'List customization groups', security: secured, responses: { '200': jsonResponse('Groups') } }, post: { tags: ['Customizations'], operationId: 'createCustomizationGroup', summary: 'Create group (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/customizations/groups/{id}': { get: { tags: ['Customizations'], operationId: 'getCustomizationGroup', summary: 'Get group', security: secured, parameters: [idParam('Group')], responses: { '200': jsonResponse('Group') } }, put: { tags: ['Customizations'], operationId: 'updateCustomizationGroup', summary: 'Update group (admin)', security: secured, parameters: [idParam('Group')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Customizations'], operationId: 'deleteCustomizationGroup', summary: 'Delete group (admin)', security: secured, parameters: [idParam('Group')], responses: { '200': jsonResponse('Deleted') } } },
    '/customizations/options': { post: { tags: ['Customizations'], operationId: 'createCustomizationOption', summary: 'Create option (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },
    '/customizations/options/{id}': { put: { tags: ['Customizations'], operationId: 'updateCustomizationOption', summary: 'Update option (admin)', security: secured, parameters: [idParam('Option')], responses: { '200': jsonResponse('Updated') } }, delete: { tags: ['Customizations'], operationId: 'deleteCustomizationOption', summary: 'Delete option (admin)', security: secured, parameters: [idParam('Option')], responses: { '200': jsonResponse('Deleted') } } },
    '/customizations/entity-links': { get: { tags: ['Customizations'], operationId: 'getEntityLinks', summary: 'List entity links', security: secured, responses: { '200': jsonResponse('Links') } }, post: { tags: ['Customizations'], operationId: 'createEntityLink', summary: 'Create entity link (admin)', security: secured, responses: { '201': jsonResponse('Created') } } },

    // ═══════════════════════════════════════════════════════════════════════════
    // GENERIC (WHITE-LABEL) ROUTES
    // ═══════════════════════════════════════════════════════════════════════════
    '/units': {
      get: { tags: ['Generic (White-Label)'], operationId: 'getUnits', summary: 'List units (generic chalets)', responses: { '200': jsonResponse('Units') } },
      post: { tags: ['Generic (White-Label)'], operationId: 'createUnit', summary: 'Create unit (admin)', security: secured, responses: { '201': jsonResponse('Created') } },
    },
    '/units/{id}': {
      get: { tags: ['Generic (White-Label)'], operationId: 'getUnit', summary: 'Get unit', parameters: [idParam('Unit')], responses: { '200': jsonResponse('Unit') } },
      put: { tags: ['Generic (White-Label)'], operationId: 'updateUnit', summary: 'Update unit (admin)', security: secured, parameters: [idParam('Unit')], responses: { '200': jsonResponse('Updated') } },
      delete: { tags: ['Generic (White-Label)'], operationId: 'deleteUnit', summary: 'Delete unit (admin)', security: secured, parameters: [idParam('Unit')], responses: { '200': jsonResponse('Deleted') } },
    },
    '/facilities/sessions': { get: { tags: ['Generic (White-Label)'], operationId: 'getFacilitySessions', summary: 'Get facility sessions', responses: { '200': jsonResponse('Sessions') } } },
    '/facilities/tickets': {
      get: { tags: ['Generic (White-Label)'], operationId: 'getFacilityTickets', summary: 'Get today facility tickets', responses: { '200': jsonResponse('Tickets') } },
      post: { tags: ['Generic (White-Label)'], operationId: 'purchaseFacilityTicket', summary: 'Purchase facility ticket', responses: { '201': jsonResponse('Purchased') } },
    },
    '/dining/menu': { get: { tags: ['Generic (White-Label)'], operationId: 'getDiningMenu', summary: 'Get dining menu', responses: { '200': jsonResponse('Menu') } } },
    '/dining/orders': {
      get: { tags: ['Generic (White-Label)'], operationId: 'getDiningOrders', summary: 'Get dining orders (staff)', security: secured, responses: { '200': jsonResponse('Orders') } },
      post: { tags: ['Generic (White-Label)'], operationId: 'createDiningOrder', summary: 'Create dining order', responses: { '201': jsonResponse('Created') } },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    '/settings': { get: { tags: ['Settings'], operationId: 'getPublicSettings', summary: 'Get public settings', responses: { '200': jsonResponse('Settings') } } },
    '/settings/tax': {
      get: { tags: ['Settings'], operationId: 'getTaxSettings', summary: 'Get tax settings', responses: { '200': jsonResponse('Tax settings') } },
      put: { tags: ['Settings'], operationId: 'updateTaxSettings', summary: 'Update tax settings (admin)', security: secured, responses: { '200': jsonResponse('Updated') } },
    },
  },

  // ── Components ──────────────────────────────────────────────────────────────
  components: {
    securitySchemes: { bearerAuth },
    responses: {
      BadRequest: { description: 'Validation error or malformed request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Unauthorized: { description: 'Missing or invalid authentication token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Forbidden: { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      NotFound: { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Conflict: { description: 'Resource conflict (duplicate)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      RateLimit: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      ServerError: { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Something went wrong' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              user: { $ref: '#/components/schemas/User' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          phone: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      MenuItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          categoryId: { type: 'string', format: 'uuid' },
          imageUrl: { type: 'string' },
          isAvailable: { type: 'boolean' },
          isVegetarian: { type: 'boolean' },
          isVegan: { type: 'boolean' },
          isGlutenFree: { type: 'boolean' },
          allergens: { type: 'array', items: { type: 'string' } },
        },
      },
      CreateOrder: {
        type: 'object',
        required: ['customerName', 'customerPhone', 'orderType', 'items'],
        properties: {
          customerName: { type: 'string', minLength: 2 },
          customerPhone: { type: 'string' },
          orderType: { type: 'string', enum: ['dine_in', 'takeaway', 'delivery'] },
          tableNumber: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['menuItemId', 'quantity'],
              properties: {
                menuItemId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', minimum: 1 },
                notes: { type: 'string' },
              },
            },
          },
          notes: { type: 'string' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'] },
          customerName: { type: 'string' },
          total: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Chalet: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          capacity: { type: 'integer' },
          basePrice: { type: 'number' },
          imageUrl: { type: 'string' },
          amenities: { type: 'array', items: { type: 'string' } },
        },
      },
      CreateBooking: {
        type: 'object',
        required: ['chaletId', 'customerName', 'customerEmail', 'checkInDate', 'checkOutDate', 'numberOfGuests', 'paymentMethod'],
        properties: {
          chaletId: { type: 'string', format: 'uuid' },
          customerName: { type: 'string' },
          customerEmail: { type: 'string', format: 'email' },
          customerPhone: { type: 'string' },
          checkInDate: { type: 'string', format: 'date' },
          checkOutDate: { type: 'string', format: 'date' },
          numberOfGuests: { type: 'integer', minimum: 1, maximum: 20 },
          paymentMethod: { type: 'string', enum: ['cash', 'card', 'online'] },
          specialRequests: { type: 'string' },
        },
      },
      PoolSession: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          capacity: { type: 'integer' },
          currentCount: { type: 'integer' },
          price: { type: 'number' },
          isAvailable: { type: 'boolean' },
        },
      },
      Terminology: {
        type: 'object',
        properties: {
          unit_singular: { type: 'string', example: 'Chalet' },
          unit_plural: { type: 'string', example: 'Chalets' },
          facility_singular: { type: 'string', example: 'Pool' },
          facility_plural: { type: 'string', example: 'Pools' },
          dining_singular: { type: 'string', example: 'Restaurant' },
          dining_plural: { type: 'string', example: 'Restaurants' },
        },
      },
    },
  },
};
