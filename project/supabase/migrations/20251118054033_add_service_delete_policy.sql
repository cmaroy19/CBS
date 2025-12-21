/*
  # Ajouter policy de suppression pour services

  1. Policy de suppression
    - Permet aux managers de supprimer les services
    - SANS restriction sur les soldes (la validation se fait côté client)
    
  Note: La vérification des soldes est faite dans l'application pour un meilleur UX
*/

-- Policy pour permettre la suppression aux managers
CREATE POLICY "Managers can delete services"
  ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  );
