# Archived Legacy Migrations

These SQL migration files were archived because they create, alter, or reference
legacy tables that violate ARCHITECTURE_LAW.md:

- restaurant_orders
- pool_tickets  
- chalet_bookings
- snack_orders

All financial/access records now use the unified `transactions` table.
See ARCHITECTURE_LAW.md for details.
