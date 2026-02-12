/**
 * Seed Script: Personal Training Sessions
 * Creates training sessions for the Personal Training module
 * 
 * Run: npx tsx seed_personal_training.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Personal Training module ID
const PERSONAL_TRAINING_MODULE_ID = '4e8a00d8-7ad4-4220-b6cf-6743cd949c0e';

interface PoolSession {
  module_id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  price: number;
  adult_price: number;
  child_price: number;
  is_active: boolean;
}

const sessions: PoolSession[] = [
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Strength Training',
    start_time: '06:00',
    end_time: '07:00',
    max_capacity: 1,
    price: 75.00,
    adult_price: 75.00,
    child_price: 0,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'HIIT Training',
    start_time: '07:30',
    end_time: '08:30',
    max_capacity: 4,
    price: 45.00,
    adult_price: 45.00,
    child_price: 30.00,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Weight Loss Program',
    start_time: '09:00',
    end_time: '10:00',
    max_capacity: 2,
    price: 65.00,
    adult_price: 65.00,
    child_price: 0,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Ladies Fitness',
    start_time: '10:30',
    end_time: '11:30',
    max_capacity: 6,
    price: 35.00,
    adult_price: 35.00,
    child_price: 25.00,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Boxing Fundamentals',
    start_time: '12:00',
    end_time: '13:00',
    max_capacity: 4,
    price: 55.00,
    adult_price: 55.00,
    child_price: 40.00,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Yoga & Flexibility',
    start_time: '14:00',
    end_time: '15:00',
    max_capacity: 8,
    price: 30.00,
    adult_price: 30.00,
    child_price: 20.00,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Senior Fitness',
    start_time: '15:30',
    end_time: '16:30',
    max_capacity: 6,
    price: 25.00,
    adult_price: 25.00,
    child_price: 15.00,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Athletic Performance',
    start_time: '17:00',
    end_time: '18:30',
    max_capacity: 2,
    price: 95.00,
    adult_price: 95.00,
    child_price: 0,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Evening Pump',
    start_time: '19:00',
    end_time: '20:00',
    max_capacity: 4,
    price: 50.00,
    adult_price: 50.00,
    child_price: 35.00,
    is_active: true
  },
  {
    module_id: PERSONAL_TRAINING_MODULE_ID,
    name: 'Men\'s Power Hour',
    start_time: '20:30',
    end_time: '21:30',
    max_capacity: 4,
    price: 45.00,
    adult_price: 45.00,
    child_price: 0,
    is_active: true
  }
];

async function seedPersonalTrainingSessions() {
  console.log('🏋️ Seeding Personal Training Sessions...');
  console.log(`Module ID: ${PERSONAL_TRAINING_MODULE_ID}`);

  // First verify the module exists
  const { data: moduleData, error: moduleError } = await supabase
    .from('modules')
    .select('id, name, is_active')
    .eq('id', PERSONAL_TRAINING_MODULE_ID)
    .single();

  if (moduleError || !moduleData) {
    console.error('❌ Personal Training module not found!');
    console.error(moduleError);
    return;
  }

  console.log(`✅ Found module: ${moduleData.name} (active: ${moduleData.is_active})`);

  // Check for existing sessions
  const { data: existingSessions } = await supabase
    .from('pool_sessions')
    .select('id, name')
    .eq('module_id', PERSONAL_TRAINING_MODULE_ID);

  if (existingSessions && existingSessions.length > 0) {
    console.log(`⚠️ Found ${existingSessions.length} existing sessions. Deleting them first...`);
    
    const { error: deleteError } = await supabase
      .from('pool_sessions')
      .delete()
      .eq('module_id', PERSONAL_TRAINING_MODULE_ID);

    if (deleteError) {
      console.error('❌ Failed to delete existing sessions:', deleteError);
      return;
    }
    console.log('✅ Existing sessions deleted');
  }

  // Insert new sessions
  console.log(`📝 Inserting ${sessions.length} training sessions...`);

  const { data: insertedSessions, error: insertError } = await supabase
    .from('pool_sessions')
    .insert(sessions)
    .select();

  if (insertError) {
    console.error('❌ Failed to insert sessions:', insertError);
    return;
  }

  console.log(`\n✅ Successfully created ${insertedSessions?.length || 0} training sessions!`);
  console.log('\n📋 Sessions created:');
  insertedSessions?.forEach((session, index) => {
    console.log(`   ${index + 1}. ${session.name} (${session.start_time} - ${session.end_time}) - $${session.price}`);
  });

  console.log('\n🎉 Personal Training module is ready for testing!');
  console.log('   Visit: http://localhost:3000/personal-training');
}

seedPersonalTrainingSessions()
  .then(() => {
    console.log('\n✨ Seed script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed script failed:', error);
    process.exit(1);
  });
