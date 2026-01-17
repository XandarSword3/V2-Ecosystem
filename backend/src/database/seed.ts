import bcrypt from 'bcryptjs';
import { getPool, initializeDatabase, closeDatabase } from './connection.js';
import { logger } from '../utils/logger.js';

async function seed() {
  try {
    await initializeDatabase();
    const pool = getPool();

    logger.info('Seeding database...');

    // Get password from environment or use default only in development
    const defaultPassword = process.env.NODE_ENV === 'production' 
      ? undefined 
      : 'admin123';
    const adminPasswordPlain = process.env.SEED_ADMIN_PASSWORD || defaultPassword;
    
    if (!adminPasswordPlain) {
      throw new Error('SEED_ADMIN_PASSWORD environment variable is required in production');
    }

    // Create roles
    await pool.query(`
      INSERT INTO roles (name, display_name, description, business_unit) VALUES
        ('super_admin', 'Super Administrator', 'Full system access', 'admin'),
        ('customer', 'Customer', 'Registered customer', NULL),
        ('restaurant_admin', 'Restaurant Admin', 'Restaurant management', 'restaurant'),
        ('restaurant_staff', 'Restaurant Staff', 'Restaurant operations', 'restaurant'),
        ('snack_bar_admin', 'Snack Bar Admin', 'Snack bar management', 'snack_bar'),
        ('snack_bar_staff', 'Snack Bar Staff', 'Snack bar operations', 'snack_bar'),
        ('chalet_admin', 'Chalet Admin', 'Chalet management', 'chalets'),
        ('chalet_staff', 'Chalet Staff', 'Chalet operations', 'chalets'),
        ('pool_admin', 'Pool Admin', 'Pool management', 'pool'),
        ('pool_staff', 'Pool Staff', 'Pool operations', 'pool')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Create admin user
    const adminPassword = await bcrypt.hash(adminPasswordPlain, 12);
    const adminResult = await pool.query(`
      INSERT INTO users (email, password_hash, full_name, email_verified, is_active)
      VALUES ('admin@v2resort.com', $1, 'System Administrator', true, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1
      RETURNING id;
    `, [adminPassword]);

    const adminId = adminResult.rows[0].id;

    // Assign super_admin role
    await pool.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = 'super_admin'
      ON CONFLICT DO NOTHING;
    `, [adminId]);

    // Create core permissions for the system
    await pool.query(`
      INSERT INTO permissions (slug, description, module_slug) VALUES
        -- Admin permissions
        ('admin.access', 'Access admin dashboard', NULL),
        ('admin.settings.view', 'View system settings', NULL),
        ('admin.settings.manage', 'Manage system settings', NULL),
        ('admin.users.view', 'View users', NULL),
        ('admin.users.manage', 'Manage users', NULL),
        ('admin.modules.view', 'View modules', NULL),
        ('admin.modules.manage', 'Manage modules', NULL),
        ('admin.reports.view', 'View reports', NULL),
        ('admin.audit.view', 'View audit logs', NULL),
        -- Customer permissions
        ('customer.orders.create', 'Create orders', NULL),
        ('customer.orders.view', 'View own orders', NULL),
        ('customer.bookings.create', 'Create bookings', NULL),
        ('customer.bookings.view', 'View own bookings', NULL)
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Link super_admin to all permissions
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id 
      FROM roles r, permissions p 
      WHERE r.name = 'super_admin'
      ON CONFLICT DO NOTHING;
    `);

    // Link customer role to customer permissions
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id 
      FROM roles r, permissions p 
      WHERE r.name = 'customer' AND p.slug LIKE 'customer.%'
      ON CONFLICT DO NOTHING;
    `);

    // Note: Sample data (menu items, chalets, pool sessions, etc.) should be added
    // through the admin interface after deployment. This keeps the seed clean.
    // The system is ready for module creation - roles and staff users are auto-created
    // when modules are added through the admin panel.

    logger.info('Seeding completed successfully');
    logger.info('');
    logger.info('Admin credentials:');
    logger.info('  Email: admin@v2resort.com');
    logger.info('  Password: [from SEED_ADMIN_PASSWORD env var or default in dev]');
    logger.info('');
    
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

seed();
