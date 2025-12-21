/*
  # Restrict Users Table Access

  1. Changes
    - Remove proprietaire from users table access
    - Only administrateur and gerant can access users table
    - Update all users table policies

  2. Security
    - Proprietaire can no longer view, create, update, or delete users
    - Only administrateur and gerant have full access to user management
    - Users can still view and update their own profile
*/

-- Drop existing policies that give access to proprietaire
DROP POLICY IF EXISTS "Users can view all active users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Admins have full access to users" ON users;

-- Create helper function to check if user is admin or gerant only
CREATE OR REPLACE FUNCTION is_admin_or_gerant()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('administrateur', 'gerant')
    AND actif = true
  );
END;
$$;

-- Policy for viewing users: only admin/gerant can view all, users can view themselves
CREATE POLICY "Admin and gerant can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_admin_or_gerant() OR auth.uid() = id);

-- Policy for updating users: admin/gerant can update all, users can update themselves
CREATE POLICY "Admin and gerant can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_gerant() OR auth.uid() = id)
  WITH CHECK (is_admin_or_gerant() OR auth.uid() = id);

-- Policy for inserting users: only admin/gerant
CREATE POLICY "Only admin and gerant can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_gerant());

-- Policy for deleting users: only admin/gerant
CREATE POLICY "Only admin and gerant can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (is_admin_or_gerant());

-- Keep admin policy for full access
CREATE POLICY "Admins have full access to users"
  ON users
  FOR ALL
  TO authenticated
  USING (is_admin());

COMMENT ON FUNCTION is_admin_or_gerant() IS 
  'Returns true if the current user is an administrator or gerant (manager)';
