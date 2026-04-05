DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'chalet_price_rules'
	) THEN
		ALTER TABLE chalet_price_rules ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2);
		ALTER TABLE chalet_price_rules ADD COLUMN IF NOT EXISTS min_guests INTEGER;
		ALTER TABLE chalet_price_rules ADD COLUMN IF NOT EXISTS max_guests INTEGER;

		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = 'chalet_price_rules' AND column_name = 'price'
		) THEN
			UPDATE chalet_price_rules
			SET base_price = price
			WHERE base_price IS NULL AND price IS NOT NULL;
		END IF;

		UPDATE chalet_price_rules
		SET min_guests = 1
		WHERE min_guests IS NULL;

		UPDATE chalet_price_rules
		SET max_guests = 10
		WHERE max_guests IS NULL;
	END IF;
END $$;
