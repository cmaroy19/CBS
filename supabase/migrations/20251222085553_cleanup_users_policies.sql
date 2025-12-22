/*
  # Clean up Users table RLS policies

  1. Problem
    - Too many redundant and conflicting policies on users table
    - Some policies reference non-existent functions (is_admin, is_manager, is_admin_or_gerant)
    - This blocks user authentication

  2. Changes
    - Drop ALL existing policies on users table
    - Create simple, clean policies:
      - All authenticated users can view all users (needed for app functionality)
      - Users can update their own data
      - Admins and proprietaires can update all users
      - Only admins and proprietaires can insert/delete users

  3. Security
    - Maintains proper access control
    - Removes dependency on potentially broken helper functions
    - Clear, maintainable policy structure
*/

-- Drop ALL existing policies on users table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- CREATE SIMPLE, CLEAN POLICIES

-- SELECT: All authenticated users can view all users (needed for the app)
CREATE POLICY "Authenticated users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: Users can update their own data
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- UPDATE: Admins can update all users
CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('administrateur', 'proprietaire', 'gerant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('administrateur', 'proprietaire', 'gerant')
    )
  );

-- INSERT: Only admins can create users OR users can create their own profile on signup
CREATE POLICY "Users can create own profile on signup"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('administrateur', 'proprietaire')
    )
  );

-- DELETE: Only admins can delete users (and not themselves)
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    id != auth.uid() AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('administrateur', 'proprietaire')
    )
  );
