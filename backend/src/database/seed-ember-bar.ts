import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectItemsTables() {
  console.log('🔍 Inspecting catalog & customization tables...');

  // Check categories table
  const { data: catSample, error: catErr } = await supabase.from('categories').select('*').limit(1);
  console.log('categories error:', catErr?.message, 'sample:', catSample);

  // Check items table
  const { data: itemSample, error: itemErr } = await supabase.from('items').select('*').limit(1);
  console.log('items error:', itemErr?.message, 'sample:', itemSample);

  // Check customizations table
  const { data: custSample, error: custErr } = await supabase.from('customizations').select('*').limit(1);
  console.log('customizations error:', custErr?.message, 'sample:', custSample);
}

inspectItemsTables();
