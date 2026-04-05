
import { getSupabase } from './src/database/connection';

const GYM_NAV = {
    links: [
        { label: 'Home', href: '/', icon: 'Home', type: 'internal' },
        { label: 'Classes', href: '/fitness-classes', icon: 'Users', type: 'module', moduleSlug: 'fitness-classes' },
        { label: 'Training', href: '/personal-training', icon: 'User', type: 'module', moduleSlug: 'personal-training' },
        { label: 'Shop', href: '/nutrition-store', icon: 'ShoppingCart', type: 'module', moduleSlug: 'nutrition-store' },
        { label: 'About', href: '/about', icon: 'Info', type: 'internal' }
    ],
    config: {
        sticky: true,
        showCart: true,
        showThemeToggle: true,
        showUserPreferences: true,
        showCurrencySwitcher: false,
        showLanguageSwitcher: true
    }
};

async function fixNav() {
    const supabase = getSupabase();
    console.log('Updating Navbar settings...');
    const { data, error } = await supabase
        .from('site_settings')
        .update({ value: GYM_NAV })
        .eq('key', 'navbar')
        .select();

    if (error) console.error('Error:', error);
    else console.log('Navbar updated:', JSON.stringify(data[0].value.links, null, 2));
    process.exit(0);
}

fixNav();
