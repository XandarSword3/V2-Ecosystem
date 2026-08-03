-- Add missing foreign key references from advanced inventory tables to users table

ALTER TABLE inventory_variance
  ADD CONSTRAINT fk_variance_counted_by FOREIGN KEY (counted_by) REFERENCES users(id);

ALTER TABLE inventory_wastage
  ADD CONSTRAINT fk_wastage_reported_by FOREIGN KEY (reported_by) REFERENCES users(id),
  ADD CONSTRAINT fk_wastage_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
  ADD CONSTRAINT fk_wastage_batch FOREIGN KEY (batch_id) REFERENCES inventory_batches(id);

ALTER TABLE inventory_purchase_orders
  ADD CONSTRAINT fk_po_created_by FOREIGN KEY (created_by) REFERENCES users(id);
