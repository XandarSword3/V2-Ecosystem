import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const footerConfig = {
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
        { platform: "facebook", url: "https://facebook.com" },
        { platform: "instagram", url: "https://instagram.com" }
    ],
    contact: {
        showAddress: true,
        showPhone: true,
        showEmail: true
    },
    copyright: "© {year} V2 Resort. All rights reserved."
};

async function seed() {
    console.log('Seeding footer settings...');

    // Check if it exists first
    const { data: existing } = await supabase
        .from('site_settings')
        .select('id')
        .eq('key', 'footer')
        .single();

    if (existing) {
        console.log('Footer exists, updating...');
        const { error } = await supabase
            .from('site_settings')
            .update({
                value: footerConfig,
                updated_at: new Date().toISOString()
            })
            .eq('key', 'footer');

        if (error) console.error('❌ Error updating:', error.message);
        else console.log('✅ Footer updated');
    } else {
        console.log('Footer does not exist, inserting...');
        const { error } = await supabase
            .from('site_settings')
            .insert({
                key: 'footer',
                value: footerConfig,
                updated_at: new Date().toISOString()
            });

        if (error) console.error('❌ Error inserting:', error.message);
        else console.log('✅ Footer inserted');
    }
}

seed();
