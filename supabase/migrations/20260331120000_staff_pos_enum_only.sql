-- staff_pos enum value must be committed before functions can reference it (Postgres 55P04).
-- Paired with 20260331120001_staff_pos_functions_and_rls.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'staff_pos'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'staff_pos';
  END IF;
END
$$;
