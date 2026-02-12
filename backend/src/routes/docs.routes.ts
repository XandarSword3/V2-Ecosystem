// File: backend/src/routes/docs.routes.ts
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from "../config/swagger.js";

const router = Router();

// Swagger UI
router.use('/ui', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// JSON Specification (for AI Agents)
router.get('/spec.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

export default router;
