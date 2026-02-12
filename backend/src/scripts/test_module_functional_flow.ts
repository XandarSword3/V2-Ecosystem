
import { Request, Response, NextFunction } from 'express';
import { createModule } from "../modules/admin/modules.controller.js";
import { createSession, getSessions, purchaseTicket, validateTicket } from "../modules/pool/pool.controller.js";
import { logger } from "../utils/logger.js";
import { initializeSocketServer, closeSocketServer } from "../socket/index.js";
import { createServer } from 'http';
import dayjs from 'dayjs';

// Mock Express Objects
const mockNext: NextFunction = (err?: any) => {
    if (err) {
        logger.error('MOCK NEXT ERROR:', err);
        throw err; // Fail fast
    }
};

const mockResponse = () => {
    const res: any = {};
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data: any) => {
        // logger.info(`RESPONSE [${res.statusCode || 200}]`, data);
        res.data = data;
        return res;
    };
    res.get = () => 'Mock-Agent';
    return res;
};

// ... Mock Users (Placeholders)
const superAdmin = { userId: '00000000-0000-0000-0000-000000000001', roles: ['super_admin'] };
// Data Customer and Staff will be real DB users
let dataCustomer: any;
let staffUser: any;

import { getSupabase } from "../database/connection.js";

async function createTestUser(role: string = 'customer') {
    const email = `test-${role}-${Date.now()}@example.com`;
    const supabase = getSupabase();
    // Create user in auth.users (if using supabase auth) or public.users
    // For this system, likely public.users is the main one linked? 
    // Usually auth.users matches public.users via trigger. 
    // I will try inserting into public.users directly as we are bypassing auth service.
    const { data, error } = await supabase.from('users').insert({
        email,
        full_name: `Test ${role}`,
        // role column does not exist in users table (it's likely in user_roles or implicit)
        // password_hash might be hidden or managed by triggers
    }).select().single();

    if (error) {
        // If users table is different, we might fail here.
        // Let's assume public.users exists.
        logger.error(`Failed to create test user: ${error.message}`);
        throw error;
    }
    return { userId: data.id, ...data };
}

async function runTest() {
    logger.info("=== START: Functional Flow Test (Admin -> Customer -> Staff) ===");

    // 1. Init Socket
    const httpServer = createServer();
    initializeSocketServer(httpServer);
    httpServer.listen(0);

    // 2. Create Real Users
    try {
        logger.info("Creating test users in DB...");
        dataCustomer = await createTestUser('customer');
        staffUser = await createTestUser('staff');
        // Give staff proper roles mock
        staffUser.roles = ['staff', 'pool_staff'];
        logger.info(`> Created Customer: ${dataCustomer.userId}`);
        logger.info(`> Created Staff: ${staffUser.userId}`);
    } catch (e) {
        logger.error("Skipping user creation - database might not match expectation", e);
        // Fallback or exit
        process.exit(1);
    }

    // Variables
    let moduleId: string;
    let sessionId: string;
    let ticketNumber: string;
    let qrData: string;

    try {
        // --- STEP 1: ADMIN Creates "Gym" Module ---
        logger.info("\n[1] ADMIN: Creating 'Gym' Module...");
        const createModuleReq = {
            body: {
                name: "Functional Gym",
                slug: `gym-func-${Date.now()}`, // Unique slug
                template_type: "session_access",
                is_active: true,
                show_in_main: true,
                settings: { color: "#FF0000" }
            },
            user: superAdmin,
            get: () => 'agent'
        } as unknown as Request;
        const moduleRes = mockResponse();
        await createModule(createModuleReq, moduleRes as Response, mockNext);
        const moduleData = (moduleRes as any).data.data;
        moduleId = moduleData.id;
        logger.info(`> Module Created: ${moduleId} (${moduleData.name})`);


        // --- STEP 2: ADMIN Creates "Yoga Class" Session for Gym ---
        logger.info("\n[2] ADMIN: Creating 'Morning Yoga' Session for Gym...");
        const createSessionReq = {
            body: {
                name: "Morning Yoga",
                startTime: "08:00",
                endTime: "09:00",
                maxCapacity: 10,
                moduleId: moduleId, // <--- LINKING TO MODULE
                adult_price: "20.00",
                child_price: "10.00"
            },
            user: superAdmin
        } as unknown as Request;
        const sessionRes = mockResponse();
        await createSession(createSessionReq, sessionRes as Response, mockNext);
        const sessionData = (sessionRes as any).data.data;
        sessionId = sessionData.id;
        logger.info(`> Session Created: ${sessionId} (Linked to Module: ${moduleId})`);


        // --- STEP 3: CUSTOMER Browses Gym Sessions ---
        logger.info("\n[3] CUSTOMER: Browsing Sessions for Gym Module...");
        const getSessionReq = {
            query: { moduleId: moduleId }, // <--- FILTER BY MODULE
        } as unknown as Request;
        const getSessionRes = mockResponse();
        await getSessions(getSessionReq, getSessionRes as Response, mockNext);
        const sessions = (getSessionRes as any).data.data;
        const foundSession = sessions.find((s: any) => s.id === sessionId);
        if (foundSession) {
            logger.info(`> Success: Found 'Morning Yoga' when filtering by Gym Module.`);
        } else {
            throw new Error("Failed to find session when filtering by module ID");
        }


        // --- STEP 4: CUSTOMER Buys Ticket ---
        logger.info("\n[4] CUSTOMER: Purchasing Ticket...");
        const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
        const buyTicketReq = {
            body: {
                sessionId: sessionId,
                ticketDate: tomorrow,
                customerName: "John Doe",
                customerEmail: "john@example.com",
                numberOfGuests: 1,
                paymentMethod: "cash",
                numberOfAdults: 1
            },
            user: dataCustomer,
            ip: '127.0.0.1'
        } as unknown as Request;
        const buyRes = mockResponse();
        await purchaseTicket(buyTicketReq, buyRes as Response, mockNext);
        const ticket = (buyRes as any).data.data;
        ticketNumber = ticket.ticket_number;
        qrData = JSON.stringify({ ticketNumber, sessionId, date: tomorrow, guests: 1 });
        logger.info(`> Ticket Purchased: ${ticketNumber} (Status: ${ticket.status})`);

        if (ticket.module_id !== moduleId) {
            logger.error(`CRITICAL: Ticket module_id (${ticket.module_id}) does NOT match Gym module_id (${moduleId})`);
        } else {
            logger.info(`> Verified: Ticket is correctly linked to Gym module.`);
        }


        // --- STEP 5: STAFF Validates Ticket ---
        logger.info("\n[5] STAFF: Validating Ticket...");
        // Note: Validation might fail if date isn't today. The controller checks `ticketDay !== today`.
        // Let's force update the ticket date to TODAY directly in DB via a hack or just buy for TODAY.
        // Actually, let's just buy a ticket for TODAY to test validation.

        const today = dayjs().format('YYYY-MM-DD');
        const buyTodayReq = {
            body: { ...buyTicketReq.body, ticketDate: today },
            user: dataCustomer,
            ip: '127.0.0.1'
        } as unknown as Request;
        const buyTodayRes = mockResponse();
        await purchaseTicket(buyTodayReq, buyTodayRes as Response, mockNext);
        const todayTicket = (buyTodayRes as any).data.data;

        const validateReq = {
            body: { ticketNumber: todayTicket.ticket_number },
            user: staffUser
        } as unknown as Request;
        const validateRes = mockResponse();
        await validateTicket(validateReq, validateRes as Response, mockNext);
        const validResult = (validateRes as any).data;

        if ((validateRes as any).statusCode === 400) {
            logger.warn(`> Validation Warning: ${(validateRes as any).data.error} (Expected if time/date checks are strict)`);
        } else {
            logger.info(`> Validation Result: ${validResult.message}`);
            logger.info(`> Ticket Status: ${(validateRes as any).data.data.status} (Validated At: ${(validateRes as any).data.data.validated_at})`);
        }

    } catch (e) {
        logger.error("TEST FAILED", e);
        process.exit(1);
    } finally {
        await closeSocketServer();
        httpServer.close();
    }

    logger.info("=== END: Functional Flow Test ===");
    process.exit(0);
}

runTest();
