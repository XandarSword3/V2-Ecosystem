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

const navbarSettings = {
    links: [
        { type: "internal", label: "Home", href: "/", icon: "Home" },
        { type: "module", label: "Restaurant", href: "/restaurant", moduleSlug: "restaurant", icon: "UtensilsCrossed" },
        { type: "module", label: "Chalets", href: "/chalets", moduleSlug: "chalets", icon: "Home" },
        { type: "module", label: "Pool", href: "/pool", moduleSlug: "pool", icon: "Waves" },
        { type: "module", label: "Snack Bar", href: "/snack-bar", moduleSlug: "snack-bar", icon: "Cookie" }
    ],
    config: {
        showLanguageSwitcher: true,
        showThemeToggle: true,
        showCurrencySwitcher: true,
        showUserPreferences: true,
        showCart: true,
        sticky: true
    }
};

async function seedNavbar() {
    console.log('Seeding navbar settings using Supabase (delete & insert)...');

    // 1. Delete existing if any
    const { error: deleteError } = await supabase
        .from('site_settings')
        .delete()
        .eq('key', 'navbar');

    if (deleteError) {
        console.error('Error deleting old navbar settings:', deleteError);
    }

    // 2. Insert new
    const { error: insertError } = await supabase
        .from('site_settings')
        .insert({
            key: 'navbar',
            value: navbarSettings,
            updated_at: new Date().toISOString()
        });

    if (insertError) {
        console.error('Error inserting navbar settings:', insertError);
    } else {
        console.log('Navbar settings seeded successfully!');
    }
}

seedNavbar();
