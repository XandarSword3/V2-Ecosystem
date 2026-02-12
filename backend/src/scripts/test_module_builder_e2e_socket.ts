
// We need to use relative paths from where this script will be executed (backend/src/scripts)
// or just use ts-node-dev on this specific file.
import { Request, Response, NextFunction } from 'express';
import { createModule, updateModule, getModule } from "../modules/admin/modules.controller.js";
import { getSupabase } from "../database/connection.js";
import { logger } from "../utils/logger.js";
import { initializeSocketServer, closeSocketServer } from "../socket/index.js";
import { createServer } from 'http';

// Mock Express Objects
const mockNext: NextFunction = (err?: any) => {
    if (err) {
        logger.error('MOCK NEXT ERROR:', err);
    }
};

const mockResponse = () => {
    const res: any = {};
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data: any) => {
        logger.info(`RESPONSE [${res.statusCode || 200}]:`, JSON.stringify(data, null, 2));
        res.data = data;
        return res;
    };
    res.get = (header: string) => {
        return 'Mock-User-Agent';
    };
    return res;
};

// Mock User for Authentication Bypass
const mockUser = {
    userId: 'e2e-tester',
    roles: ['super_admin']
};

async function runTest() {
    logger.info("=== START: Module Builder E2E Test ===");

    // Initialize Socket Server to prevent "Socket.io not initialized" error
    const httpServer = createServer();
    initializeSocketServer(httpServer);
    httpServer.listen(0); // Random port
    logger.info("Socket Server Initialized");

    const slug = `e2e-gym-${Date.now()}`;
    logger.info(`Creating module with slug: ${slug}`);

    try {
        // Test 1: Create Module
        const createReq = {
            body: {
                name: "E2E Gym Module",
                slug: slug,
                description: "Automated E2E Test Module",
                template_type: "session_access",
                is_active: true,
                show_in_main: true,
                settings: {
                    header_color: "#123456",
                    accent_color: "#654321",
                    show_in_nav: true
                }
            },
            user: mockUser,
            ip: '127.0.0.1',
            get: (header: string) => 'Mock-User-Agent'
        } as unknown as Request;

        const createRes = mockResponse();
        await createModule(createReq, createRes as Response, mockNext);

        // @ts-ignore
        const createdModule = createRes.data?.data;
        if (!createdModule || !createdModule.id) {
            logger.error("Failed to create module (API error)");
            process.exit(1);
        }
        const moduleId = createdModule.id;
        logger.info(`Module Created: ${moduleId}`);

        // Test 2: Update Module Layout ( simulating Builder Save )
        logger.info("Updating Module Layout...");
        const layout = [
            { id: "header-1", type: "header", props: { title: "Welcome to Gym" } },
            { id: "scheduler-1", type: "scheduler", props: { mode: "daily" } }
        ];

        const updateReq = {
            params: { id: moduleId },
            body: {
                settings: {
                    ...createdModule.settings, // keep existing colors
                    layout: layout // Add layout
                }
            },
            user: mockUser, // Need permission to update
            ip: '127.0.0.1',
            get: (header: string) => 'Mock-User-Agent'
        } as unknown as Request;

        const updateRes = mockResponse();
        await updateModule(updateReq, updateRes as Response, mockNext);

        // Test 3: Verify Persistence via Get
        logger.info("Verifying persistence...");
        const getReq = {
            params: { id: moduleId },
            user: mockUser
        } as unknown as Request;
        const getRes = mockResponse();
        await getModule(getReq, getRes as Response, mockNext);

        // @ts-ignore
        const fetchedModule = getRes.data?.data;
        const savedLayout = fetchedModule?.settings?.layout;

        if (savedLayout && savedLayout.length === 2 && savedLayout[0].id === 'header-1') {
            logger.info("SUCCESS: Layout persisted correctly.");
        } else {
            logger.error("FAILURE: Layout verification failed.", savedLayout);
        }

    } finally {
        await closeSocketServer();
        httpServer.close();
    }

    logger.info("=== END: Module Builder E2E Test ===");
    process.exit(0);
}

runTest().catch(err => {
    logger.error("Unhandled Error", err);
    process.exit(1);
});
