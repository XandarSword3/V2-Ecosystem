
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MESSAGES_DIR = path.resolve(__dirname, '../../../frontend/messages');
const LOCALES = ['en', 'ar', 'fr'];

async function syncTranslations() {
  console.log('Hub: Starting translation sync...');
  
  for (const locale of LOCALES) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Missing file for locale ${locale}`);
      continue;
    }

    console.log(`Processing ${locale}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const sections = JSON.parse(content);

    // Iterate over namespaces (e.g., "common", "auth")
    for (const [namespace, keys] of Object.entries(sections)) {
      if (typeof keys !== 'object' || keys === null) continue;

      const records = [];
      
      // Iterate over keys in namespace
      for (const [key, value] of Object.entries(keys as Record<string, string>)) {
        records.push({
          namespace,
          key,
          locale,
          value: String(value), // Ensure string
          status: 'published', // Pre-seeded content is published
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      if (records.length > 0) {
        // Upsert in batches
        const { error } = await supabase
          .from('translations')
          .upsert(records, { 
            onConflict: 'namespace,key,locale',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`Error upserting ${namespace}/${locale}:`, error.message);
        } else {
          console.log(`Synced ${records.length} keys for [${locale}] in [${namespace}]`);
        }
      }
    }
  }

  console.log('Sync complete.');
}

syncTranslations().catch(console.error);
