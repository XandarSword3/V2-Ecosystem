import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAdmin() {
    console.log('Resetting admin password...');
    const email = 'admin@v2resort.com';
    const newPassword = 'admin123';
    
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // Check if user exists
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email)
            .single();
            
        if (findError && findError.code !== 'PGRST116') {
            console.error('Error finding user:', findError);
            return;
        }
        
        if (user) {
            console.log(`User found (ID: ${user.id}). Updating password...`);
            const { error: updateError } = await supabase
                .from('users')
                .update({ 
                    password_hash: hashedPassword,
                    is_active: true,
                    email_verified: true
                })
                .eq('id', user.id);
                
            if (updateError) {
                console.error('Error updating password:', updateError);
            } else {
                console.log('✅ Admin password successfully updated to: admin123');
            }
        } else {
            console.log('User not found. Creating admin user...');
            const { error: createError } = await supabase
                .from('users')
                .insert({
                    email,
                    password_hash: hashedPassword,
                    full_name: 'System Administrator',
                    email_verified: true,
                    is_active: true
                });
                
            if (createError) {
                console.error('Error creating admin:', createError);
            } else {
                console.log('✅ Admin user created with password: admin123');
            }
        }
        
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

resetAdmin();
