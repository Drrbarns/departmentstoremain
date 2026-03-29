DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status'
      AND e.enumlabel = 'picked_up'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'picked_up' BEFORE 'delivered';
  END IF;
END $$;
