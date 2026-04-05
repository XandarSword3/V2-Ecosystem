-- Allow creating reservations without a pre-assigned table
-- Table can be assigned later via the admin "Assign Table" workflow
ALTER TABLE table_reservations ALTER COLUMN table_id DROP NOT NULL;
