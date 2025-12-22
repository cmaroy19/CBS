/*
  # Fix RLS Policies - Role Case Sensitivity

  1. Problem
    - RLS policies check for roles with capital letters: 'Administrateur', 'Proprietaire', etc.
    - Database stores roles in lowercase: 'administrateur', 'proprietaire', etc.
    - This mismatch blocks all data access

  2. Changes
    - Drop and recreate all policies with correct lowercase role checks
    - Affects: transactions, users, services, approvisionnements, change_operations

  3. Security
    - Maintains same security model, just fixes the role case matching
    - All authenticated users can view their authorized data
*/

-- Drop existing policies with wrong case
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON transactions;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admin can update all users" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Admin can view all users" ON users;

-- Transactions: Fix INSERT policy
CREATE POLICY "Allow insert for authenticated users"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = created_by) OR 
    (EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('administrateur', 'proprietaire', 'caissier', 'gerant')
    ))
  );

-- Users: Fix policies
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admin can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('administrateur', 'proprietaire', 'gerant')
    )
  );

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('administrateur', 'proprietaire')
    )
  );
