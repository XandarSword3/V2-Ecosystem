require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in environment (.env)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'edc6f22a-33ba-4928-973c-1ad013c46944';
const propertyId = 'e3faca29-d160-4d02-a93e-844efdbc4396';

async function queryDatabase() {
  console.log('Querying user and property information...\n');

  // Query user information
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('Error fetching user:', userError);
  } else {
    console.log('=== USER INFORMATION ===');
    console.log(JSON.stringify(user, null, 2));
  }

  // Query property information
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (propertyError) {
    console.error('Error fetching property:', propertyError);
  } else {
    console.log('\n=== PROPERTY INFORMATION ===');
    console.log(JSON.stringify(property, null, 2));
  }

  // Query user property assignments from user_property_access table
  const { data: userProperties, error: userPropertiesError } = await supabase
    .from('user_property_access')
    .select('*')
    .eq('user_id', userId);

  if (userPropertiesError) {
    console.error('Error fetching user properties:', userPropertiesError);
  } else {
    console.log('\n=== USER PROPERTY ASSIGNMENTS (user_property_access) ===');
    console.log(`Total properties assigned to user: ${userProperties.length}`);
    userProperties.forEach(up => {
      console.log(`- Property ID: ${up.property_id}, Role: ${up.role}`);
    });
  }

  // Query user roles
  const { data: userRoles, error: userRolesError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId);

  if (userRolesError) {
    console.error('Error fetching user roles:', userRolesError);
  } else {
    console.log('\n=== USER ROLES ===');
    userRoles.forEach(role => {
      console.log(`- Role: ${role.role}`);
    });
  }

  // Check if user has platform admin access
  const { data: platformAdmin, error: platformAdminError } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (platformAdminError && platformAdminError.code !== 'PGRST116') {
    console.error('Error fetching platform admin:', platformAdminError);
  } else {
    console.log('\n=== PLATFORM ADMIN STATUS ===');
    console.log(platformAdmin ? 'User is a platform admin' : 'User is NOT a platform admin');
  }

  // Query all properties to see what's available
  const { data: allProperties, error: allPropertiesError } = await supabase
    .from('properties')
    .select('id, name, public_slug, tenant_id');

  if (allPropertiesError) {
    console.error('Error fetching all properties:', allPropertiesError);
  } else {
    console.log('\n=== ALL AVAILABLE PROPERTIES ===');
    allProperties.forEach(prop => {
      console.log(`- ID: ${prop.id}, Name: ${prop.name}, Slug: ${prop.public_slug}, Tenant: ${prop.tenant_id}`);
    });
  }

  // Check if user has any properties in their tenant
  const { data: tenantProperties, error: tenantPropertiesError } = await supabase
    .from('properties')
    .select('id, name')
    .eq('tenant_id', user.tenant_id);

  if (tenantPropertiesError) {
    console.error('Error fetching tenant properties:', tenantPropertiesError);
  } else {
    console.log('\n=== PROPERTIES IN USER\'S TENANT ===');
    console.log(`User's tenant ID: ${user.tenant_id}`);
    tenantProperties.forEach(prop => {
      console.log(`- ID: ${prop.id}, Name: ${prop.name}`);
    });
  }

  // Create the missing user_property_access entry
  console.log('\n=== CREATING MISSING USER_PROPERTY_ACCESS ENTRY ===');
  const { data: insertResult, error: insertError } = await supabase
    .from('user_property_access')
    .insert({
      user_id: userId,
      property_id: propertyId,
      tenant_id: user.tenant_id,
      access_level: 'admin'
    })
    .select();

  if (insertError) {
    console.error('Error creating user_property_access entry:', insertError);
  } else {
    console.log('Successfully created user_property_access entry:', insertResult);
  }

  // Verify the entry was created
  const { data: verifyAccess, error: verifyError } = await supabase
    .from('user_property_access')
    .select('*')
    .eq('user_id', userId)
    .eq('property_id', propertyId);

  if (verifyError) {
    console.error('Error verifying user_property_access:', verifyError);
  } else {
    console.log('\n=== VERIFIED USER_PROPERTY_ACCESS ===');
    console.log(JSON.stringify(verifyAccess, null, 2));
  }

  // Check catalog_items table schema by selecting a sample row
  console.log('\n=== VERIFYING METADATA COLUMN ADDED ===');
  const { data: sampleItem, error: sampleError } = await supabase
    .from('catalog_items')
    .select('metadata')
    .limit(1);

  if (sampleError) {
    console.error('Error querying catalog_items metadata column:', sampleError);
    console.log('This means metadata column does NOT exist');
  } else {
    console.log('✓ Metadata column exists - query succeeded');
    if (sampleItem && sampleItem.length > 0) {
      console.log('Sample metadata value:', sampleItem[0].metadata);
    } else {
      console.log('No items in table, but metadata column exists');
    }
  }
}

queryDatabase().then(() => {
  console.log('\nQuery complete.');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
