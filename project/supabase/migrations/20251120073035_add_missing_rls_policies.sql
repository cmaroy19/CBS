/*
  # Ajouter les politiques RLS manquantes

  1. Nouvelles politiques
    - users: Managers peuvent UPDATE/DELETE (sauf eux-mêmes pour DELETE)
    - approvisionnements: Managers peuvent UPDATE/DELETE
    
  2. Sécurité
    - Restriction stricte: seuls proprietaire et gerant peuvent gérer
    - Protection contre auto-suppression pour users
*/

-- Politiques pour users table

CREATE POLICY "Managers can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('proprietaire', 'gerant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('proprietaire', 'gerant')
    )
  );

CREATE POLICY "Managers can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('proprietaire', 'gerant')
    )
    AND users.id != auth.uid()
  );

-- Politiques pour approvisionnements table

CREATE POLICY "Managers can update approvisionnements"
  ON approvisionnements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  );

CREATE POLICY "Managers can delete approvisionnements"
  ON approvisionnements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  );
