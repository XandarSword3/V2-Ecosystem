// File: backend/src/config/swagger.ts
// Uses the comprehensive hand-crafted OpenAPI spec that covers ALL route groups.
// The old swagger-jsdoc approach relied on JSDoc annotations in route files,
// but most routes lacked them — resulting in sparse documentation.
// This approach provides a single source of truth for the full API surface.

import { openApiFullSpec } from '../docs/openapi-spec.js';

export const swaggerSpec = openApiFullSpec;
