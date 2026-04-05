import { Client } from 'pg';
import * as dotenv from 'dotenv';

async function main() {
    dotenv.config();
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected.');

        const res = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_class t ON c.conrelid = t.oid 
            WHERE t.relname IN ('gift_cards', 'loyalty_transactions')
        `);

        console.log('CONSTRAINTS_SQL_START');
        console.log(JSON.stringify(res.rows, null, 2));
        console.log('CONSTRAINTS_SQL_END');

    } catch (err: any) {
        console.error('ERROR:', err.message);
    } finally {
        await client.end();
    }
}

main();
