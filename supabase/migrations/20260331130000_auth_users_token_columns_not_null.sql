-- GoTrue fails login with "Database error querying schema" if token columns are NULL
-- (see supabase/auth#1940). Safe to run repeatedly; only touches NULLs.

UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR recovery_token IS NULL
   OR email_change_token_current IS NULL
   OR reauthentication_token IS NULL;
