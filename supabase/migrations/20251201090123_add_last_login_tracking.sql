/*
  # Add Last Login Tracking

  1. Changes
    - Add last_login column to users table to track login activity
    - Create trigger to automatically update last_login on auth sign-in
    - Create function to calculate user status (active/inactive based on last 5 minutes)

  2. Security
    - Function runs with SECURITY DEFINER to access auth schema
    - Only updates last_login for authenticated users
    - Uses proper search_path for security

  3. Notes
    - Active status: user logged in within last 5 minutes
    - Inactive status: user logged in more than 5 minutes ago or never
    - Trigger fires on successful authentication
*/

-- Add last_login column if it doesn't exist (for custom users table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'last_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Function to update last_login when user signs in
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the custom users table last_login
  UPDATE users
  SET last_login = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;

-- Create trigger that fires when auth.users.last_sign_in_at is updated
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION update_user_last_login();

-- Function to check if user is currently active (logged in within last 5 minutes)
CREATE OR REPLACE FUNCTION is_user_active(user_last_login timestamptz)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF user_last_login IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN (NOW() - user_last_login) < INTERVAL '5 minutes';
END;
$$;

COMMENT ON COLUMN users.last_login IS 'Timestamp of the user''s last successful login';
COMMENT ON FUNCTION update_user_last_login() IS 'Automatically updates last_login in users table when user signs in';
COMMENT ON FUNCTION is_user_active(timestamptz) IS 'Returns true if user logged in within last 5 minutes';
