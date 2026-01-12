/**
 * OpenAPI 3.0 Specification for V2 Resort API
 * 
 * This provides interactive API documentation via Swagger UI.
 * Access at: /api/docs
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'V2 Resort Management API',
    version: '1.0.0',
    description: `
# V2 Resort Management System API

A comprehensive REST API for managing resort operations including restaurant, chalets, pool, and more.

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## Rate Limiting
- General API: 100 requests per 15 minutes per IP
- Auth endpoints: 5 requests per 15 minutes per IP

## Response Format
All responses follow this structure:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
\`\`\`

Error responses:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "requestId": "correlation-id"
}
\`\`\`
    `,
    contact: {
      name: 'V2 Resort Support',
      email: 'support@v2resort.com',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Auth', description: 'Authentication and authorization' },
    { name: 'Users', description: 'User profile management' },
    { name: 'Restaurant', description: 'Restaurant menu and orders' },
    { name: 'Chalets', description: 'Chalet bookings and availability' },
    { name: 'Pool', description: 'Pool sessions and tickets' },
    { name: 'Admin', description: 'Administrative operations' },
    { name: 'Payments', description: 'Payment processing' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Basic health check',
        description: 'Returns OK if the server is running',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'user@example.com' },
                  password: { type: 'string', minLength: 8, example: 'SecurePass123!' },
                  fullName: { type: 'string', example: 'John Doe' },
                  phone: { type: 'string', example: '+1234567890' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': { description: 'Validation error' },
          '409': { description: 'Email already registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
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
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'User profile',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          '401': { description: 'Not authenticated' },
        },
      },
    },
    '/restaurant/menu': {
      get: {
        tags: ['Restaurant'],
        summary: 'Get restaurant menu',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category slug' },
          { name: 'dietary', in: 'query', schema: { type: 'string' }, description: 'Filter by dietary (vegetarian, vegan, etc.)' },
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
    '/restaurant/orders': {
      post: {
        tags: ['Restaurant'],
        summary: 'Create new order',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrder' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Order created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          '400': { description: 'Validation error' },
        },
      },
      get: {
        tags: ['Restaurant'],
        summary: 'Get orders (staff/admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': {
            description: 'List of orders',
          },
        },
      },
    },
    '/restaurant/orders/{id}/status': {
      patch: {
        tags: ['Restaurant'],
        summary: 'Update order status',
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
                  status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Status updated' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/chalets': {
      get: {
        tags: ['Chalets'],
        summary: 'List all chalets',
        responses: {
          '200': {
            description: 'List of chalets',
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
    '/chalets/{id}/availability': {
      get: {
        tags: ['Chalets'],
        summary: 'Check chalet availability',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'Availability information',
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
                        blockedDates: { type: 'array', items: { type: 'string', format: 'date' } },
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
        summary: 'Create booking',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateBooking' },
            },
          },
        },
        responses: {
          '201': { description: 'Booking created' },
          '400': { description: 'Validation error or dates unavailable' },
          '409': { description: 'Double booking conflict' },
        },
      },
    },
    '/pool/sessions': {
      get: {
        tags: ['Pool'],
        summary: 'Get available pool sessions',
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'List of sessions',
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
        summary: 'Purchase pool ticket',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId', 'customerName', 'customerEmail'],
                properties: {
                  sessionId: { type: 'string', format: 'uuid' },
                  customerName: { type: 'string' },
                  customerEmail: { type: 'string', format: 'email' },
                  customerPhone: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1, maximum: 10, default: 1 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Ticket purchased' },
          '400': { description: 'Session full or invalid' },
        },
      },
    },
    '/pool/tickets/{id}/validate': {
      post: {
        tags: ['Pool'],
        summary: 'Validate ticket (staff)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Ticket validated' },
          '400': { description: 'Already used or invalid' },
          '404': { description: 'Ticket not found' },
        },
      },
    },
    '/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'Get dashboard statistics',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Dashboard data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        todayRevenue: { type: 'number' },
                        todayOrders: { type: 'integer' },
                        todayBookings: { type: 'integer' },
                        activeUsers: { type: 'integer' },
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
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'List of users' },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create user',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  fullName: { type: 'string' },
                  roles: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User created' },
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
      },
    },
    schemas: {
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
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
          startTime: { type: 'string', format: 'time' },
          endTime: { type: 'string', format: 'time' },
          capacity: { type: 'integer' },
          currentCount: { type: 'integer' },
          price: { type: 'number' },
          isAvailable: { type: 'boolean' },
        },
      },
    },
  },
};

export default openApiSpec;
