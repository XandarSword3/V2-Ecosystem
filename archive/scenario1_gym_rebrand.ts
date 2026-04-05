import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3005';
const API_URL = `${BASE_URL}/api/v1`;

// Supabase Setup for direct DB manipulation (Disabling default modules)
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Iron Paradise Gym Branding Configuration
const GYM_BRANDING = {
    businessName: 'Iron Paradise Gym',
    tagline: 'Transform Your Body, Transform Your Life',
    description: 'Premium fitness center offering personal training, group classes, and nutrition products.',
    email: 'info@ironparadisegym.com',
    phone: '+1 (555) GYM-LIFT',
    address: '123 Fitness Boulevard, Los Angeles, CA 90001',
    website: 'https://ironparadisegym.com',
    primaryColor: '#C41E3A',      // Deep Red
    secondaryColor: '#36454F',    // Charcoal
    accentColor: '#FFD700',       // Gold
    headingFont: 'Oswald',
    bodyFont: 'Roboto',
    showPoweredBy: false,
    facebook: 'https://facebook.com/ironparadisegym',
    instagram: 'https://instagram.com/ironparadisegym',
    twitter: 'https://twitter.com/ironparadisegym',
    linkedin: ''
};

// Homepage CMS Content for Gym
const GYM_HOMEPAGE = {
    hero: {
        title: 'Transform Your Body at Iron Paradise Gym',
        subtitle: 'Premium Fitness Center | Personal Training | Group Classes',
        ctaText: 'Start Your Fitness Journey',
        ctaLink: '/membership',
        backgroundImage: '/images/gym-hero.jpg'
    },
    features: [
        {
            title: 'State-of-the-Art Equipment',
            description: 'Over 200 pieces of premium fitness equipment including free weights, machines, and cardio.',
            icon: 'Dumbbell'
        },
        {
            title: 'Expert Personal Trainers',
            description: 'NASM certified trainers ready to help you achieve your fitness goals.',
            icon: 'User'
        },
        {
            title: 'Group Fitness Classes',
            description: 'Yoga, Spin, HIIT, and more. 50+ classes per week for all fitness levels.',
            icon: 'Users'
        },
        {
            title: 'Nutrition Store',
            description: 'Premium supplements, protein, and healthy snacks to fuel your workouts.',
            icon: 'ShoppingCart'
        }
    ],
    stats: [
        { label: 'Active Members', value: '500+' },
        { label: 'Classes Per Week', value: '50+' },
        { label: 'Access Hours', value: '24/7' },
        { label: 'Personal Trainers', value: '15' }
    ],
    testimonials: [
        {
            name: 'Mike Johnson',
            role: 'Lost 30lbs in 3 Months',
            content: 'Iron Paradise changed my life. The trainers are amazing and the equipment is top-notch.',
            avatar: '/images/testimonials/mike.jpg'
        },
        {
            name: 'Sarah Chen',
            role: 'Marathon Ready',
            content: 'The group classes pushed me to achieve my first marathon. Best gym community ever!',
            avatar: '/images/testimonials/sarah.jpg'
        },
        {
            name: 'David Rodriguez',
            role: 'Gained 15lbs Muscle',
            content: 'The personal training program helped me build muscle I never thought possible.',
            avatar: '/images/testimonials/david.jpg'
        }
    ]
};

// Gym Footer Configuration
const GYM_FOOTER = {
    links: [
        { label: 'About Iron Paradise', href: '/about' },
        { label: 'Membership Plans', href: '/membership' },
        { label: 'Class Schedule', href: '/classes' },
        { label: 'Personal Training', href: '/training' },
        { label: 'Contact Us', href: '/contact' }
    ],
    socialLinks: {
        facebook: 'https://facebook.com/ironparadisegym',
        instagram: 'https://instagram.com/ironparadisegym',
        twitter: 'https://twitter.com/ironparadisegym'
    },
    contact: {
        address: '123 Fitness Boulevard, Los Angeles, CA 90001',
        phone: '+1 (555) GYM-LIFT',
        email: 'info@ironparadisegym.com'
    },
    copyright: '© 2026 Iron Paradise Gym. All rights reserved.'
};

// Modules to create for gym
const GYM_MODULES = [
    {
        template_type: 'session_access',
        name: 'Group Fitness Classes',
        slug: 'fitness-classes',
        description: 'Book your spot in yoga, spin, HIIT, and more',
        settings: {
            icon: 'Dumbbell',
            capacity_enabled: true,
            booking_advance_days: 7,
            cancellation_hours: 2
        }
    },
    {
        template_type: 'session_access',
        name: 'Personal Training',
        slug: 'personal-training',
        description: 'One-on-one sessions with certified trainers',
        settings: {
            icon: 'User',
            staff_selection: true,
            packages_enabled: true,
            cancellation_hours: 24
        }
    },
    {
        template_type: 'menu_service',
        name: 'Nutrition Store',
        slug: 'nutrition-store',
        description: 'Supplements, protein, and healthy snacks',
        settings: {
            icon: 'ShoppingCart',
            inventory_tracking: true,
            modifiers_enabled: true
        }
    }
];

async function executeGymRebrand() {
    console.log('=== SCENARIO 1: IRON PARADISE GYM REBRANDING ===\n');

    let cookies: string[] = [];
    let csrfToken = '';
    let authToken = '';

    const results = {
        branding: { success: false, error: '' },
        homepage: { success: false, error: '' },
        footer: { success: false, error: '' },
        modules: [] as { name: string; success: boolean; error: string; id?: string }[]
    };

    try {
        // 1. Get CSRF Token
        console.log('1. Fetching CSRF token...');
        const csrfRes = await axios.get(`${BASE_URL}/api/csrf-token`, { withCredentials: true });
        csrfToken = csrfRes.data.csrfToken || '';
        if (csrfRes.headers['set-cookie']) {
            cookies = csrfRes.headers['set-cookie'];
        }
        console.log('   ✅ CSRF token obtained\n');

        // 2. Login as admin
        console.log('2. Logging in as admin...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@v2resort.com',
            password: 'admin123'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                'Cookie': cookies.join('; ')
            }
        });

        if (!loginRes.data.success) throw new Error('Login failed');
        authToken = loginRes.data.data.tokens.accessToken;
        console.log('   ✅ Login successful\n');

        const authHeaders = {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
            'Authorization': `Bearer ${authToken}`,
            'Cookie': cookies.join('; ')
        };

        // 3. Update Branding
        console.log('3. Updating branding settings...');
        try {
            // Endpoint mounted at /admin/branding, PUT matches controller root
            const brandRes = await axios.put(`${API_URL}/admin/branding`, GYM_BRANDING, { headers: authHeaders });
            if (brandRes.data.success) {
                results.branding.success = true;
                console.log('   ✅ Branding updated: Iron Paradise Gym');
                console.log('      Colors: Red #C41E3A, Charcoal #36454F, Gold #FFD700');
            }
        } catch (e: any) {
            results.branding.error = e.response?.data?.message || e.message;
            console.log('   ❌ Branding update failed:', results.branding.error);
        }

        // 3.5 Update General Settings (Critical for Metadata/ResortName)
        console.log('3.5 Updating general settings (Resort Name)...');
        try {
            const generalRes = await axios.put(`${API_URL}/admin/settings`, {
                resortName: GYM_BRANDING.businessName,
                tagline: GYM_BRANDING.tagline,
                description: GYM_BRANDING.description,
                email: GYM_BRANDING.email,
                phone: GYM_BRANDING.phone,
                address: GYM_BRANDING.address
            }, { headers: authHeaders });

            if (generalRes.data.success) {
                console.log('   ✅ General settings updated: resortName synced');
            }
        } catch (e: any) {
            console.log('   ❌ General Settings update failed:', e.response?.data?.message || e.message);
        }

        // 4. Update Homepage CMS
        console.log('\n4. Updating homepage content...');
        try {
            // Update via Settings API
            const homepageRes = await axios.put(`${API_URL}/admin/settings/homepage`, GYM_HOMEPAGE, { headers: authHeaders });
            if (homepageRes.data.success || homepageRes.status === 200) {
                results.homepage.success = true;
                console.log('   ✅ Homepage updated with gym content');
            }
        } catch (e: any) {
            results.homepage.error = e.response?.data?.message || e.message;
            console.log('   ❌ Homepage CMS update failed:', results.homepage.error);
        }

        // 5. Update Footer CMS
        console.log('\n5. Updating footer content...');
        try {
            const footerRes = await axios.put(`${API_URL}/admin/settings/footer`, GYM_FOOTER, { headers: authHeaders });
            if (footerRes.data.success || footerRes.status === 200) {
                results.footer.success = true;
                console.log('   ✅ Footer updated with gym content');
            }
        } catch (e: any) {
            results.footer.error = e.response?.data?.message || e.message;
            console.log('   ❌ Footer CMS update failed:', results.footer.error);
        }
        // 5.5 Disable Default Resort Modules
        console.log('\n5.5 Disabling default resort modules...');
        try {
            const defaultSlugs = ['restaurant', 'chalets', 'pool', 'snack'];
            const { error: disableError } = await supabase
                .from('modules')
                .update({ is_enabled: false })
                .in('slug', defaultSlugs);

            if (disableError) {
                console.log('   ❌ Error disabling default modules:', disableError.message);
            } else {
                console.log('   ✅ Default resort modules disabled (Restaurant, Chalets, Pool, Snack Bar)');
            }
        } catch (e: any) {
            console.log('   Warning: DB update failed:', e.message);
        }

        // 6. Create Gym Modules
        console.log('\n6. Creating gym modules...');
        for (const module of GYM_MODULES) {
            console.log(`   Creating: ${module.name}...`);
            try {
                const modRes = await axios.post(`${API_URL}/admin/modules`, module, { headers: authHeaders });
                if (modRes.data.success) {
                    results.modules.push({
                        name: module.name,
                        success: true,
                        error: '',
                        id: modRes.data.data.id
                    });
                    console.log(`   ✅ Created: ${module.name} (ID: ${modRes.data.data.id})`);
                }
            } catch (e: any) {
                const errorMsg = e.response?.data?.error || e.message;

                // Check if duplicate key error
                if (errorMsg && (errorMsg.includes('unique constraint') || errorMsg.includes('already exists'))) {
                    console.log(`   ⚠️ Module ${module.slug} already exists. Skipping.`);
                    results.modules.push({
                        name: module.name,
                        success: true,
                        error: 'Already exists (skipped creation)',
                        id: 'existing'
                    });
                } else {
                    // Try to randomize slug and retry? No, just fail for now.
                    results.modules.push({
                        name: module.name,
                        success: false,
                        error: errorMsg
                    });
                    console.log(`   ❌ Failed: ${module.name} - ${errorMsg}`);
                }
            }
        }

        // 7. Summary
        console.log('\n\n=== SCENARIO 1 RESULTS ===');
        console.log(`Branding: ${results.branding.success ? '✅ PASS' : '❌ FAIL'} ${results.branding.error}`);
        console.log(`Homepage: ${results.homepage.success ? '✅ PASS' : '❌ FAIL'} ${results.homepage.error}`);
        console.log(`Footer:   ${results.footer.success ? '✅ PASS' : '❌ FAIL'} ${results.footer.error}`);
        console.log('\nModules:');
        results.modules.forEach(m => {
            console.log(`  ${m.success ? '✅' : '❌'} ${m.name} ${m.id ? `(${m.id})` : ''} ${m.error}`);
        });

        // Calculate score
        let score = 0;
        if (results.branding.success) score += 20;
        if (results.homepage.success) score += 10;
        if (results.footer.success) score += 10;
        results.modules.forEach(m => { if (m.success) score += 10; });

        console.log(`\nSCORE (Phase 1): ${score}/60 points`);

        return results;

    } catch (error: any) {
        console.error('Fatal error:', error.message);
        return results;
    }
}

executeGymRebrand();
