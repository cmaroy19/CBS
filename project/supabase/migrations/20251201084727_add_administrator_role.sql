/*
  # Add Administrator Role

  1. Changes
    - Add 'administrateur' to the role CHECK constraint in users table
    - Update all RLS policies to include administrator with full access
    - Create helper function to check if user is admin

  2. Security
    - Administrator has full access to all tables and operations
    - RLS policies are updated to include admin checks
    - Admin can manage all users, services, transactions, etc.
*/

-- Drop existing CHECK constraint and add new one with 'administrateur'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('administrateur', 'proprietaire', 'gerant', 'caissier'));

-- Create helper function to check if user is admin or proprietaire
CREATE OR REPLACE FUNCTION is_admin_or_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('administrateur', 'proprietaire')
    AND actif = true
  );
END;
$$;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'administrateur'
    AND actif = true
  );
END;
$$;

-- Update users table policies to give admin full access
DROP POLICY IF EXISTS "Admins have full access to users" ON users;
CREATE POLICY "Admins have full access to users"
  ON users
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Update services table policies
DROP POLICY IF EXISTS "Admins have full access to services" ON services;
CREATE POLICY "Admins have full access to services"
  ON services
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Update transactions table policies
DROP POLICY IF EXISTS "Admins have full access to transactions" ON transactions;
CREATE POLICY "Admins have full access to transactions"
  ON transactions
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Update approvisionnements table policies
DROP POLICY IF EXISTS "Admins have full access to approvisionnements" ON approvisionnements;
CREATE POLICY "Admins have full access to approvisionnements"
  ON approvisionnements
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Update change_operations table policies
DROP POLICY IF EXISTS "Admins have full access to change_operations" ON change_operations;
CREATE POLICY "Admins have full access to change_operations"
  ON change_operations
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Update global_balances table policies
DROP POLICY IF EXISTS "Admins have full access to global_balances" ON global_balances;
CREATE POLICY "Admins have full access to global_balances"
  ON global_balances
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Update audit_logs table policies
DROP POLICY IF EXISTS "Admins have full access to audit_logs" ON audit_logs;
CREATE POLICY "Admins have full access to audit_logs"
  ON audit_logs
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Update existing users select policy to include admin
DROP POLICY IF EXISTS "Users can view all active users" ON users;
CREATE POLICY "Users can view all active users"
  ON users
  FOR SELECT
  TO authenticated
  USING (actif = true OR is_admin_or_owner());

-- Update existing users update policy
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR is_admin_or_owner())
  WITH CHECK (auth.uid() = id OR is_admin_or_owner());

-- Allow admins to insert users
DROP POLICY IF EXISTS "Admins can insert users" ON users;
CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_owner());

-- Allow admins to delete users
DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (is_admin_or_owner());

COMMENT ON COLUMN users.role IS 
  'User role: administrateur (full access), proprietaire (owner), gerant (manager), caissier (cashier)';
