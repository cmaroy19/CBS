/*
  # Create Daily Commissions Management System

  1. New Tables
    - `commissions_journalieres`
      - `id` (uuid, primary key)
      - `date_cloture` (date, unique) - Date de clôture journalière
      - `commission_usd` (numeric) - Commission USD saisie manuellement
      - `commission_cdf` (numeric) - Commission CDF saisie manuellement
      - `service_id` (uuid, nullable) - Service concerné (null = global)
      - `notes` (text, nullable) - Notes ou observations
      - `saisie_par` (uuid) - Utilisateur ayant saisi les commissions
      - `created_at` (timestamptz) - Date de création
      - `updated_at` (timestamptz) - Dernière modification

  2. Security
    - Enable RLS on `commissions_journalieres` table
    - Add policies for authenticated users:
      - SELECT: All authenticated users can view
      - INSERT: Only caissier, gerant, proprietaire, administrateur
      - UPDATE: Only gerant, proprietaire, administrateur (for corrections)
      - DELETE: Only proprietaire, administrateur

  3. Indexes
    - Index on date_cloture for fast lookups
    - Index on service_id for filtering by service
*/

-- Create commissions_journalieres table
CREATE TABLE IF NOT EXISTS commissions_journalieres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_cloture date NOT NULL,
  commission_usd numeric(15,2) NOT NULL DEFAULT 0,
  commission_cdf numeric(15,2) NOT NULL DEFAULT 0,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  notes text,
  saisie_par uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_daily_commission_per_service UNIQUE(date_cloture, service_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_commissions_date ON commissions_journalieres(date_cloture DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_service ON commissions_journalieres(service_id);

-- Enable RLS
ALTER TABLE commissions_journalieres ENABLE ROW LEVEL SECURITY;

-- SELECT policy: All authenticated users can view commissions
CREATE POLICY "Authenticated users can view commissions"
  ON commissions_journalieres
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT policy: Only caissier, gerant, proprietaire, administrateur can insert
CREATE POLICY "Authorized users can insert commissions"
  ON commissions_journalieres
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('caissier', 'gerant', 'proprietaire', 'administrateur')
      AND users.actif = true
    )
  );

-- UPDATE policy: Only gerant, proprietaire, administrateur can update
CREATE POLICY "Managers can update commissions"
  ON commissions_journalieres
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('gerant', 'proprietaire', 'administrateur')
      AND users.actif = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('gerant', 'proprietaire', 'administrateur')
      AND users.actif = true
    )
  );

-- DELETE policy: Only proprietaire, administrateur can delete
CREATE POLICY "Admins can delete commissions"
  ON commissions_journalieres
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'administrateur')
      AND users.actif = true
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_commissions_timestamp
  BEFORE UPDATE ON commissions_journalieres
  FOR EACH ROW
  EXECUTE FUNCTION update_commissions_updated_at();