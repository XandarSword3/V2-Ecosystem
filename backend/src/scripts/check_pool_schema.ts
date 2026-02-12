
import { getSupabase } from "../database/connection.js";

async function checkSchema() {
    const supabase = getSupabase();

    console.log("--- Checking pool_sessions columns ---");
    const { data: sessions, error: sErr } = await supabase.from('pool_sessions').select('*').limit(1);
    if (sErr) console.error(sErr);
    else if (sessions && sessions.length > 0) console.log(Object.keys(sessions[0]));
    else console.log("No sessions found to check columns");

    console.log("\n--- Checking pool_tickets columns ---");
    const { data: tickets, error: tErr } = await supabase.from('pool_tickets').select('*').limit(1);
    if (tErr) console.error(tErr);
    else if (tickets && tickets.length > 0) console.log(Object.keys(tickets[0]));
    else console.log("No tickets found to check columns");
}

checkSchema();
