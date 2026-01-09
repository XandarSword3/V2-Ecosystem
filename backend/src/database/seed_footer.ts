import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const footerSettings = {
    logo: {
        text: "V2 Resort",
        showIcon: true
    },
    description: "Premium destination for exceptional dining, comfortable chalets, and refreshing pool experiences in the heart of Lebanon.",
    columns: [
        {
            title: "Quick Links",
            links: [
                { label: "Restaurant", href: "/restaurant" },
                { label: "Snack Bar", href: "/snack-bar" },
                { label: "Chalets", href: "/chalets" },
                { label: "Pool", href: "/pool" }
            ]
        },
        {
            title: "Legal",
            links: [
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Cancellation Policy", href: "/cancellation" }
            ]
        }
    ],
    socials: [
        { platform: "facebook", url: "https://facebook.com/v2resort" },
        { platform: "instagram", url: "https://instagram.com/v2resort" },
        { platform: "twitter", url: "https://twitter.com/v2resort" }
    ],
    contact: {
        showAddress: true,
        showPhone: true,
        showEmail: true
    },
    copyright: "© {year} V2 Resort. All rights reserved."
};

async function seedFooter() {
    console.log('Seeding footer settings using Supabase (delete & insert)...');

    // 1. Delete existing if any
    const { error: deleteError } = await supabase
        .from('site_settings')
        .delete()
        .eq('key', 'footer');

    if (deleteError) {
        console.error('Error deleting old footer settings:', deleteError);
    }

    // 2. Insert new
    const { error: insertError } = await supabase
        .from('site_settings')
        .insert({
            key: 'footer',
            value: footerSettings,
            updated_at: new Date().toISOString()
        });

    if (insertError) {
        console.error('Error inserting footer settings:', insertError);
    } else {
        console.log('Footer settings seeded successfully!');
    }
}

seedFooter();
