/**
 * OpenAPI 3.0.3 Specification for V2 Resort API v1
 * 
 * Complete API contract for mobile app development.
 * All mobile apps MUST use /api/v1/* endpoints.
 * 
 * @version 1.0.0
 * @stability stable
 */

export const openApiV1Spec = {
  openapi: '3.0.3',
  info: {
    title: 'V2 Resort Management API',
    version: '1.0.0',
    description: `
# V2 Resort Management System API - Version 1

This is the stable API contract for V2 Resort. **Mobile apps must use \`/api/v1/*\` endpoints.**

## Versioning Policy
- **v1** is the current stable version
- Breaking changes will result in a new API version (v2)
- Deprecation notices will be provided 6 months before removal
- The \`X-API-Deprecation\` header indicates deprecated endpoints

## Authentication
JWT Bearer token authentication is required for most endpoints.

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### Token Lifecycle
- **Access Token**: Valid for 15 minutes
- **Refresh Token**: Valid for 7 days
- Use \`POST /api/v1/auth/refresh\` before access token expires
- On 401 response, attempt token refresh before showing login

## Rate Limiting
- General API: 1000 requests/minute
- Auth endpoints: 10 requests/15 minutes
- Financial operations: 100 requests/minute
- Headers: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

## Error Handling
All errors follow RFC 7807 Problem Details format:
\`\`\`json
{
  "success": false,
  "error": "Human readable message",
  "code": "ERROR_CODE",
  "requestId": "correlation-id",
  "details": {}
}
\`\`\`

## Platforms
- **Web**: Standard browser requests
- **iOS**: Include \`X-Platform: ios\` and \`X-App-Version\` headers
- **Android**: Include \`X-Platform: android\` and \`X-App-Version\` headers
    `,
    contact: {
      name: 'V2 Resort API Support',
      email: 'api-support@v2resort.com',
      url: 'https://v2resort.com/support',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 (Recommended for mobile)',
    },
    {
      url: '/api',
      description: 'Legacy API (deprecated for mobile)',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check and status endpoints' },
    { name: 'Auth', description: 'Authentication, registration, and session management' },
    { name: 'Users', description: 'User profile management' },
    { name: 'Devices', description: 'Device registration and push notification management' },
    { name: 'Restaurant', description: 'Menu, categories, and order management' },
    { name: 'Chalets', description: 'Chalet listings, bookings, and availability' },
    { name: 'Pool', description: 'Pool sessions, tickets, and capacity' },
    { name: 'Snack Bar', description: 'Snack bar menu and orders' },
    { name: 'Payments', description: 'Payment processing and transactions' },
    { name: 'Loyalty', description: 'Loyalty program and points management' },
    { name: 'Gift Cards', description: 'Gift card purchase and redemption' },
    { name: 'Coupons', description: 'Coupon validation and application' },
    { name: 'Support', description: 'Customer support tickets' },
    { name: 'Reviews', description: 'Customer reviews and ratings' },
    { name: 'Admin', description: 'Administrative operations (restricted)' },
  ],
  paths: {
    // ============================================
    // HEALTH ENDPOINTS
    // ============================================
    '/': {
      get: {
        tags: ['Health'],
        operationId: 'getApiInfo',
        summary: 'Get API version information',
        description: 'Returns API version, status, and available endpoints',
        responses: {
          '200': {
            description: 'API information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiInfo' },
              },
            },
          },
        },
      },
    },

    // ============================================
    // AUTH ENDPOINTS
    // ============================================
    '/auth/register': {
      post: {
        tags: ['Auth'],
        operationId: 'register',
        summary: 'Register new user account',
        description: 'Creates a new user account and returns authentication tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Registration successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '409': { $ref: '#/components/responses/ConflictError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        operationId: 'login',
        summary: 'User login',
        description: 'Authenticates user and returns JWT tokens. May return 2FA challenge.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful or 2FA required',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/AuthResponse' },
                    { $ref: '#/components/schemas/TwoFactorChallenge' },
                  ],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        operationId: 'refreshToken',
        summary: 'Refresh access token',
        description: 'Exchange refresh token for new access/refresh token pair. Implements token rotation.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshTokenRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token refreshed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        operationId: 'logout',
        summary: 'Logout current session',
        description: 'Invalidates current access token',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logout successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        operationId: 'getCurrentUser',
        summary: 'Get current user profile',
        description: 'Returns the authenticated user profile with roles and permissions',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'User profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/UserProfile' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        operationId: 'forgotPassword',
        summary: 'Request password reset',
        description: 'Sends password reset email to user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Reset email sent (always returns success for security)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '429': { $ref: '#/components/responses/RateLimitError' },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        operationId: 'resetPassword',
        summary: 'Reset password with token',
        description: 'Resets password using token from email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string', description: 'Reset token from email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Password reset successful' },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { description: 'Invalid or expired token' },
        },
      },
    },
    '/auth/change-password': {
      put: {
        tags: ['Auth'],
        operationId: 'changePassword',
        summary: 'Change password (authenticated)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Password changed' },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
    '/auth/2fa/status': {
      get: {
        tags: ['Auth'],
        operationId: 'get2FAStatus',
        summary: 'Get 2FA status',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: '2FA status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean' },
                        backupCodesRemaining: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/2fa/setup': {
      post: {
        tags: ['Auth'],
        operationId: 'setup2FA',
        summary: 'Initialize 2FA setup',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: '2FA setup data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        secret: { type: 'string' },
                        qrCodeUrl: { type: 'string' },
                        manualEntryKey: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/2fa/enable': {
      post: {
        tags: ['Auth'],
        operationId: 'enable2FA',
        summary: 'Enable 2FA with verification code',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string', pattern: '^[0-9]{6}$' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '2FA enabled, returns backup codes',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        backupCodes: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid verification code' },
        },
      },
    },
    '/auth/2fa/verify': {
      post: {
        tags: ['Auth'],
        operationId: 'verify2FA',
        summary: 'Verify 2FA code during login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tempToken', 'code'],
                properties: {
                  tempToken: { type: 'string', description: 'Temporary token from login response' },
                  code: { type: 'string', pattern: '^[0-9]{6}$' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '2FA verified, returns auth tokens',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '401': { description: 'Invalid code or token' },
        },
      },
    },
    '/auth/2fa/disable': {
      post: {
        tags: ['Auth'],
        operationId: 'disable2FA',
        summary: 'Disable 2FA',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string', pattern: '^[0-9]{6}$' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '2FA disabled' },
          '400': { description: 'Invalid code' },
        },
      },
    },

    // ============================================
    // DEVICE MANAGEMENT ENDPOINTS
    // ============================================
    '/devices': {
      get: {
        tags: ['Devices'],
        operationId: 'getUserDevices',
        summary: 'List registered devices',
        description: 'Returns all devices registered for push notifications',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of devices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    devices: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Device' },
                    },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
    '/devices/register': {
      post: {
        tags: ['Devices'],
        operationId: 'registerDevice',
        summary: 'Register device for push notifications',
        description: 'Registers a device token for FCM/APNS push notifications',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DeviceRegistration' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Device registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    device: { $ref: '#/components/schemas/Device' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },
    '/devices/unregister': {
      delete: {
        tags: ['Devices'],
        operationId: 'unregisterDevice',
        summary: 'Unregister device',
        description: 'Removes device from push notification list',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceToken'],
                properties: {
                  deviceToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Device unregistered' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },
    '/devices/{deviceId}/preferences': {
      patch: {
        tags: ['Devices'],
        operationId: 'updateDevicePreferences',
        summary: 'Update device notification preferences',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'deviceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notificationsEnabled: { type: 'boolean' },
                  deviceName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Preferences updated' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },
    '/devices/{deviceId}': {
      delete: {
        tags: ['Devices'],
        operationId: 'removeDevice',
        summary: 'Remove device (hard delete)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'deviceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Device removed' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },
    '/devices/logout-all': {
      post: {
        tags: ['Devices'],
        operationId: 'logoutAllDevices',
        summary: 'Logout from all devices',
        description: 'Invalidates all device tokens for push notifications',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  exceptCurrent: { type: 'boolean', description: 'Keep current device registered' },
                  currentDeviceToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'All devices logged out' },
        },
      },
    },

    // ============================================
    // RESTAURANT ENDPOINTS
    // ============================================
    '/restaurant/menu': {
      get: {
        tags: ['Restaurant'],
        operationId: 'getMenu',
        summary: 'Get restaurant menu',
        description: 'Returns menu items with optional filtering',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category slug' },
          { name: 'dietary', in: 'query', schema: { type: 'string', enum: ['vegetarian', 'vegan', 'gluten_free'] } },
          { name: 'available', in: 'query', schema: { type: 'boolean' }, description: 'Filter by availability' },
        ],
        responses: {
          '200': {
            description: 'Menu items',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/MenuItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/restaurant/categories': {
      get: {
        tags: ['Restaurant'],
        operationId: 'getCategories',
        summary: 'Get menu categories',
        responses: {
          '200': {
            description: 'Categories',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Category' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/restaurant/orders': {
      post: {
        tags: ['Restaurant'],
        operationId: 'createOrder',
        summary: 'Create new order',
        description: 'Creates a restaurant order. Supports guest checkout.',
        security: [{ bearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Order created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Order' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
      get: {
        tags: ['Restaurant'],
        operationId: 'getOrders',
        summary: 'Get orders (staff only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'] } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': { description: 'Orders list' },
          '403': { $ref: '#/components/responses/ForbiddenError' },
        },
      },
    },
    '/restaurant/orders/{id}': {
      get: {
        tags: ['Restaurant'],
        operationId: 'getOrderById',
        summary: 'Get order details',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Order details' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },
    '/restaurant/orders/{id}/status': {
      patch: {
        tags: ['Restaurant'],
        operationId: 'updateOrderStatus',
        summary: 'Update order status (staff only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Status updated' },
          '403': { $ref: '#/components/responses/ForbiddenError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },
    '/restaurant/orders/track/{orderNumber}': {
      get: {
        tags: ['Restaurant'],
        operationId: 'trackOrder',
        summary: 'Track order by order number (public)',
        description: 'Allows customers to track their order status',
        parameters: [
          { name: 'orderNumber', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Order tracking info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        orderNumber: { type: 'string' },
                        status: { type: 'string' },
                        estimatedTime: { type: 'integer', description: 'Minutes' },
                        items: { type: 'array' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },

    // ============================================
    // CHALETS ENDPOINTS
    // ============================================
    '/chalets': {
      get: {
        tags: ['Chalets'],
        operationId: 'getChalets',
        summary: 'List all chalets',
        parameters: [
          { name: 'available', in: 'query', schema: { type: 'boolean' } },
          { name: 'minCapacity', in: 'query', schema: { type: 'integer' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          '200': {
            description: 'Chalets list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Chalet' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/chalets/{id}': {
      get: {
        tags: ['Chalets'],
        operationId: 'getChaletById',
        summary: 'Get chalet details',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Chalet details' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },
    '/chalets/{id}/availability': {
      get: {
        tags: ['Chalets'],
        operationId: 'checkChaletAvailability',
        summary: 'Check chalet availability',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'Availability info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        available: { type: 'boolean' },
                        totalPrice: { type: 'number' },
                        blockedDates: {
                          type: 'array',
                          items: { type: 'string', format: 'date' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/chalets/bookings': {
      post: {
        tags: ['Chalets'],
        operationId: 'createBooking',
        summary: 'Create chalet booking',
        security: [{ bearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateBookingRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Booking created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Booking' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '409': { description: 'Dates not available' },
        },
      },
    },

    // ============================================
    // POOL ENDPOINTS
    // ============================================
    '/pool/sessions': {
      get: {
        tags: ['Pool'],
        operationId: 'getPoolSessions',
        summary: 'Get pool sessions',
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'Sessions list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PoolSession' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/pool/tickets': {
      post: {
        tags: ['Pool'],
        operationId: 'purchasePoolTicket',
        summary: 'Purchase pool ticket',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PurchaseTicketRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Ticket purchased',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/PoolTicket' },
                  },
                },
              },
            },
          },
          '400': { description: 'Session full or invalid' },
        },
      },
    },
    '/pool/tickets/{id}/validate': {
      post: {
        tags: ['Pool'],
        operationId: 'validatePoolTicket',
        summary: 'Validate ticket (staff)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Ticket validated' },
          '400': { description: 'Already used or expired' },
          '403': { $ref: '#/components/responses/ForbiddenError' },
          '404': { $ref: '#/components/responses/NotFoundError' },
        },
      },
    },

    // ============================================
    // PAYMENTS ENDPOINTS
    // ============================================
    '/payments/create-intent': {
      post: {
        tags: ['Payments'],
        operationId: 'createPaymentIntent',
        summary: 'Create Stripe payment intent',
        description: 'Creates a payment intent for card payments, Apple Pay, or Google Pay',
        security: [{ bearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePaymentIntentRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment intent created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        clientSecret: { type: 'string' },
                        paymentIntentId: { type: 'string' },
                        amount: { type: 'integer', description: 'Amount in cents' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/payments/methods': {
      get: {
        tags: ['Payments'],
        operationId: 'getPaymentMethods',
        summary: 'Get saved payment methods',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Payment methods',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PaymentMethod' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ============================================
    // LOYALTY ENDPOINTS
    // ============================================
    '/loyalty/me': {
      get: {
        tags: ['Loyalty'],
        operationId: 'getMyLoyaltyAccount',
        summary: 'Get my loyalty account',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Loyalty account',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/LoyaltyAccount' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/loyalty/me/transactions': {
      get: {
        tags: ['Loyalty'],
        operationId: 'getMyLoyaltyTransactions',
        summary: 'Get my points transactions',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Transactions list' },
        },
      },
    },
    '/loyalty/tiers': {
      get: {
        tags: ['Loyalty'],
        operationId: 'getLoyaltyTiers',
        summary: 'Get loyalty tiers',
        responses: {
          '200': {
            description: 'Tiers list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/LoyaltyTier' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/loyalty/calculate': {
      post: {
        tags: ['Loyalty'],
        operationId: 'calculateLoyaltyPoints',
        summary: 'Calculate points for purchase',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount'],
                properties: {
                  amount: { type: 'number' },
                  userId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Points calculation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        pointsToEarn: { type: 'integer' },
                        multiplier: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ============================================
    // GIFT CARDS ENDPOINTS
    // ============================================
    '/giftcards/validate/{code}': {
      get: {
        tags: ['Gift Cards'],
        operationId: 'validateGiftCard',
        summary: 'Validate gift card code',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Gift card info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/GiftCard' },
                  },
                },
              },
            },
          },
          '404': { description: 'Invalid gift card' },
        },
      },
    },
    '/giftcards/purchase': {
      post: {
        tags: ['Gift Cards'],
        operationId: 'purchaseGiftCard',
        summary: 'Purchase gift card',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PurchaseGiftCardRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'Gift card purchased' },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },

    // ============================================
    // COUPONS ENDPOINTS
    // ============================================
    '/coupons/active': {
      get: {
        tags: ['Coupons'],
        operationId: 'getActiveCoupons',
        summary: 'Get active public coupons',
        responses: {
          '200': {
            description: 'Active coupons',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Coupon' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/coupons/validate': {
      post: {
        tags: ['Coupons'],
        operationId: 'validateCoupon',
        summary: 'Validate coupon code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string' },
                  amount: { type: 'number', description: 'Order subtotal' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        menuItemId: { type: 'string' },
                        categoryId: { type: 'string' },
                        quantity: { type: 'integer' },
                        price: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Coupon validation result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        valid: { type: 'boolean' },
                        discount: { type: 'number' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/coupons/apply': {
      post: {
        tags: ['Coupons'],
        operationId: 'applyCoupon',
        summary: 'Apply coupon to order',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'orderId'],
                properties: {
                  code: { type: 'string' },
                  orderId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Coupon applied' },
          '400': { description: 'Invalid or expired coupon' },
        },
      },
    },

    // ============================================
    // SUPPORT ENDPOINTS
    // ============================================
    '/support/tickets': {
      post: {
        tags: ['Support'],
        operationId: 'createSupportTicket',
        summary: 'Create support ticket',
        security: [{ bearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSupportTicketRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'Ticket created' },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
      get: {
        tags: ['Support'],
        operationId: 'getMyTickets',
        summary: 'Get my support tickets',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Tickets list' },
        },
      },
    },

    // ============================================
    // REVIEWS ENDPOINTS
    // ============================================
    '/reviews': {
      post: {
        tags: ['Reviews'],
        operationId: 'createReview',
        summary: 'Create review',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateReviewRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'Review created' },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
      get: {
        tags: ['Reviews'],
        operationId: 'getReviews',
        summary: 'Get reviews',
        parameters: [
          { name: 'entityType', in: 'query', schema: { type: 'string', enum: ['restaurant', 'chalet', 'pool'] } },
          { name: 'entityId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          '200': { description: 'Reviews list' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token',
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required or token invalid',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'Invalid or expired token',
              code: 'AUTH_INVALID_TOKEN',
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'Insufficient permissions',
              code: 'AUTH_FORBIDDEN',
            },
          },
        },
      },
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'Resource not found',
              code: 'NOT_FOUND',
            },
          },
        },
      },
      ConflictError: {
        description: 'Resource conflict',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'Email already registered',
              code: 'CONFLICT_DUPLICATE',
            },
          },
        },
      },
      RateLimitError: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'Too many requests',
              code: 'RATE_LIMIT_EXCEEDED',
            },
          },
        },
        headers: {
          'X-RateLimit-Limit': {
            schema: { type: 'integer' },
            description: 'Request limit per window',
          },
          'X-RateLimit-Remaining': {
            schema: { type: 'integer' },
            description: 'Remaining requests',
          },
          'X-RateLimit-Reset': {
            schema: { type: 'integer' },
            description: 'Unix timestamp when limit resets',
          },
        },
      },
    },
    schemas: {
      // ============================================
      // COMMON SCHEMAS
      // ============================================
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          code: {
            type: 'string',
            description: 'Machine-readable error code',
            enum: [
              'AUTH_INVALID_TOKEN',
              'AUTH_EXPIRED_TOKEN',
              'AUTH_FORBIDDEN',
              'AUTH_INVALID_CREDENTIALS',
              'AUTH_2FA_REQUIRED',
              'VALIDATION_ERROR',
              'NOT_FOUND',
              'CONFLICT_DUPLICATE',
              'RATE_LIMIT_EXCEEDED',
              'PAYMENT_FAILED',
              'MODULE_DISABLED',
              'INTERNAL_ERROR',
            ],
          },
          requestId: { type: 'string', format: 'uuid' },
          details: { type: 'object' },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Validation failed' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
                code: { type: 'string' },
              },
            },
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'array' },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
      ApiInfo: {
        type: 'object',
        properties: {
          version: { type: 'string', example: '1.0.0' },
          apiVersion: { type: 'string', example: 'v1' },
          status: { type: 'string', enum: ['stable', 'deprecated', 'beta'] },
          deprecation: { type: 'string', nullable: true },
          documentation: { type: 'string' },
          endpoints: { type: 'object' },
        },
      },

      // ============================================
      // AUTH SCHEMAS
      // ============================================
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 8, example: 'SecurePass123!' },
          fullName: { type: 'string', minLength: 2, maxLength: 100, example: 'John Doe' },
          phone: { type: 'string', example: '+1234567890' },
          preferredLanguage: { type: 'string', enum: ['en', 'ar'], default: 'en' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'integer', description: 'Seconds until access token expires' },
              user: { $ref: '#/components/schemas/UserProfile' },
            },
          },
        },
      },
      TwoFactorChallenge: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              requiresTwoFactor: { type: 'boolean', example: true },
              tempToken: { type: 'string', description: 'Temporary token for 2FA verification' },
            },
          },
        },
      },
      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          phone: { type: 'string', nullable: true },
          profileImageUrl: { type: 'string', nullable: true },
          preferredLanguage: { type: 'string' },
          roles: {
            type: 'array',
            items: { type: 'string' },
            example: ['customer'],
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
          },
          twoFactorEnabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },

      // ============================================
      // DEVICE SCHEMAS
      // ============================================
      Device: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          platform: { type: 'string', enum: ['ios', 'android', 'web'] },
          deviceName: { type: 'string', nullable: true },
          deviceModel: { type: 'string', nullable: true },
          appVersion: { type: 'string', nullable: true },
          osVersion: { type: 'string', nullable: true },
          notificationsEnabled: { type: 'boolean' },
          isActive: { type: 'boolean' },
          lastUsedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      DeviceRegistration: {
        type: 'object',
        required: ['deviceToken', 'platform'],
        properties: {
          deviceToken: { type: 'string', description: 'FCM/APNS token' },
          platform: { type: 'string', enum: ['ios', 'android', 'web'] },
          deviceName: { type: 'string', example: 'iPhone 15 Pro' },
          deviceModel: { type: 'string', example: 'iPhone15,3' },
          appVersion: { type: 'string', example: '1.0.0' },
          osVersion: { type: 'string', example: '17.0' },
          notificationsEnabled: { type: 'boolean', default: true },
        },
      },

      // ============================================
      // RESTAURANT SCHEMAS
      // ============================================
      MenuItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          nameAr: { type: 'string' },
          description: { type: 'string' },
          descriptionAr: { type: 'string' },
          price: { type: 'number' },
          categoryId: { type: 'string', format: 'uuid' },
          categoryName: { type: 'string' },
          imageUrl: { type: 'string', nullable: true },
          isAvailable: { type: 'boolean' },
          isVegetarian: { type: 'boolean' },
          isVegan: { type: 'boolean' },
          isGlutenFree: { type: 'boolean' },
          allergens: { type: 'array', items: { type: 'string' } },
          preparationTime: { type: 'integer', description: 'Minutes' },
          calories: { type: 'integer', nullable: true },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          nameAr: { type: 'string' },
          slug: { type: 'string' },
          imageUrl: { type: 'string', nullable: true },
          sortOrder: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['customerName', 'customerPhone', 'orderType', 'items'],
        properties: {
          customerName: { type: 'string', minLength: 2 },
          customerPhone: { type: 'string' },
          customerEmail: { type: 'string', format: 'email' },
          orderType: { type: 'string', enum: ['dine_in', 'takeaway', 'delivery'] },
          tableNumber: { type: 'string', nullable: true },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['menuItemId', 'quantity'],
              properties: {
                menuItemId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', minimum: 1, maximum: 99 },
                notes: { type: 'string', maxLength: 200 },
                addons: {
                  type: 'array',
                  items: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
          notes: { type: 'string', maxLength: 500 },
          couponCode: { type: 'string' },
          giftCardCode: { type: 'string' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'] },
          orderType: { type: 'string', enum: ['dine_in', 'takeaway', 'delivery'] },
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          tableNumber: { type: 'string', nullable: true },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                menuItemId: { type: 'string' },
                name: { type: 'string' },
                quantity: { type: 'integer' },
                unitPrice: { type: 'number' },
                totalPrice: { type: 'number' },
                notes: { type: 'string' },
              },
            },
          },
          subtotal: { type: 'number' },
          discount: { type: 'number' },
          tax: { type: 'number' },
          total: { type: 'number' },
          paymentStatus: { type: 'string', enum: ['pending', 'paid', 'refunded'] },
          estimatedTime: { type: 'integer', description: 'Minutes' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ============================================
      // CHALET SCHEMAS
      // ============================================
      Chalet: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          nameAr: { type: 'string' },
          description: { type: 'string' },
          descriptionAr: { type: 'string' },
          capacity: { type: 'integer' },
          bedrooms: { type: 'integer' },
          bathrooms: { type: 'integer' },
          basePrice: { type: 'number' },
          weekendPrice: { type: 'number' },
          imageUrl: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
          amenities: { type: 'array', items: { type: 'string' } },
          isAvailable: { type: 'boolean' },
          rating: { type: 'number', nullable: true },
          reviewCount: { type: 'integer' },
        },
      },
      CreateBookingRequest: {
        type: 'object',
        required: ['chaletId', 'customerName', 'customerEmail', 'checkInDate', 'checkOutDate', 'numberOfGuests'],
        properties: {
          chaletId: { type: 'string', format: 'uuid' },
          customerName: { type: 'string' },
          customerEmail: { type: 'string', format: 'email' },
          customerPhone: { type: 'string' },
          checkInDate: { type: 'string', format: 'date' },
          checkOutDate: { type: 'string', format: 'date' },
          numberOfGuests: { type: 'integer', minimum: 1, maximum: 20 },
          specialRequests: { type: 'string', maxLength: 500 },
          addons: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          bookingNumber: { type: 'string' },
          chaletId: { type: 'string', format: 'uuid' },
          chaletName: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'] },
          checkInDate: { type: 'string', format: 'date' },
          checkOutDate: { type: 'string', format: 'date' },
          numberOfGuests: { type: 'integer' },
          totalPrice: { type: 'number' },
          paymentStatus: { type: 'string', enum: ['pending', 'partial', 'paid', 'refunded'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ============================================
      // POOL SCHEMAS
      // ============================================
      PoolSession: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          date: { type: 'string', format: 'date' },
          startTime: { type: 'string', format: 'time' },
          endTime: { type: 'string', format: 'time' },
          capacity: { type: 'integer' },
          currentCount: { type: 'integer' },
          availableSpots: { type: 'integer' },
          adultPrice: { type: 'number' },
          childPrice: { type: 'number' },
          isAvailable: { type: 'boolean' },
        },
      },
      PurchaseTicketRequest: {
        type: 'object',
        required: ['sessionId', 'customerName', 'customerEmail'],
        properties: {
          sessionId: { type: 'string', format: 'uuid' },
          customerName: { type: 'string' },
          customerEmail: { type: 'string', format: 'email' },
          customerPhone: { type: 'string' },
          adults: { type: 'integer', minimum: 0, default: 1 },
          children: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      PoolTicket: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ticketNumber: { type: 'string' },
          sessionId: { type: 'string', format: 'uuid' },
          sessionName: { type: 'string' },
          date: { type: 'string', format: 'date' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          adults: { type: 'integer' },
          children: { type: 'integer' },
          totalPrice: { type: 'number' },
          status: { type: 'string', enum: ['valid', 'used', 'expired', 'cancelled'] },
          qrCode: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ============================================
      // PAYMENT SCHEMAS
      // ============================================
      CreatePaymentIntentRequest: {
        type: 'object',
        required: ['amount', 'referenceType', 'referenceId'],
        properties: {
          amount: { type: 'integer', description: 'Amount in cents', minimum: 100 },
          currency: { type: 'string', default: 'usd', enum: ['usd', 'aed', 'eur'] },
          referenceType: { type: 'string', enum: ['restaurant_order', 'chalet_booking', 'pool_ticket', 'gift_card'] },
          referenceId: { type: 'string', format: 'uuid' },
          platform: { type: 'string', enum: ['web', 'ios', 'android'], description: 'Payment platform' },
          paymentMethodTypes: {
            type: 'array',
            items: { type: 'string', enum: ['card', 'apple_pay', 'google_pay'] },
            default: ['card'],
          },
          metadata: { type: 'object' },
        },
      },
      PaymentMethod: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['card', 'apple_pay', 'google_pay'] },
          card: {
            type: 'object',
            properties: {
              brand: { type: 'string' },
              last4: { type: 'string' },
              expMonth: { type: 'integer' },
              expYear: { type: 'integer' },
            },
          },
          isDefault: { type: 'boolean' },
        },
      },

      // ============================================
      // LOYALTY SCHEMAS
      // ============================================
      LoyaltyAccount: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          points: { type: 'integer' },
          lifetimePoints: { type: 'integer' },
          tier: { $ref: '#/components/schemas/LoyaltyTier' },
          pointsToNextTier: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      LoyaltyTier: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          minPoints: { type: 'integer' },
          multiplier: { type: 'number' },
          benefits: { type: 'array', items: { type: 'string' } },
          color: { type: 'string' },
        },
      },

      // ============================================
      // GIFT CARD SCHEMAS
      // ============================================
      GiftCard: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          originalAmount: { type: 'number' },
          currentBalance: { type: 'number' },
          isActive: { type: 'boolean' },
          expiresAt: { type: 'string', format: 'date', nullable: true },
        },
      },
      PurchaseGiftCardRequest: {
        type: 'object',
        required: ['amount', 'recipientEmail'],
        properties: {
          amount: { type: 'number', minimum: 10, maximum: 500 },
          recipientEmail: { type: 'string', format: 'email' },
          recipientName: { type: 'string' },
          senderName: { type: 'string' },
          message: { type: 'string', maxLength: 200 },
        },
      },

      // ============================================
      // COUPON SCHEMAS
      // ============================================
      Coupon: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          description: { type: 'string' },
          discountType: { type: 'string', enum: ['percentage', 'fixed'] },
          discountValue: { type: 'number' },
          minimumOrder: { type: 'number', nullable: true },
          maximumDiscount: { type: 'number', nullable: true },
          validFrom: { type: 'string', format: 'date-time' },
          validUntil: { type: 'string', format: 'date-time' },
          usageLimit: { type: 'integer', nullable: true },
          usageCount: { type: 'integer' },
        },
      },

      // ============================================
      // SUPPORT SCHEMAS
      // ============================================
      CreateSupportTicketRequest: {
        type: 'object',
        required: ['subject', 'message', 'category'],
        properties: {
          subject: { type: 'string', minLength: 5, maxLength: 200 },
          message: { type: 'string', minLength: 10, maxLength: 2000 },
          category: { type: 'string', enum: ['general', 'booking', 'payment', 'technical', 'complaint', 'feedback'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
          relatedOrderId: { type: 'string', format: 'uuid' },
          relatedBookingId: { type: 'string', format: 'uuid' },
        },
      },

      // ============================================
      // REVIEW SCHEMAS
      // ============================================
      CreateReviewRequest: {
        type: 'object',
        required: ['entityType', 'entityId', 'rating'],
        properties: {
          entityType: { type: 'string', enum: ['restaurant', 'chalet', 'pool', 'order'] },
          entityId: { type: 'string', format: 'uuid' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          title: { type: 'string', maxLength: 100 },
          comment: { type: 'string', maxLength: 1000 },
        },
      },
    },
  },
};

export default openApiV1Spec;
