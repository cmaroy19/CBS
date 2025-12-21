/*
  # Correction des Policies RLS pour Permettre la Validation
  
  ## Description
  La policy UPDATE actuelle empêche de changer le statut de 'brouillon' à 'validee'
  car elle exige que le statut reste 'brouillon' (with_check).
  
  Cette migration ajoute une policy séparée pour permettre la validation des transactions.
  
  ## Changes
  1. Ajouter une policy UPDATE pour permettre la validation (brouillon → validee)
  2. L'ancienne policy reste pour les modifications en mode brouillon
  
  ## Security
  - Seul le créateur peut valider sa propre transaction
  - La transaction doit être en statut 'brouillon'
  - Le changement ne peut être que vers 'validee'
*/

-- Ajouter une policy pour permettre la validation des transactions
CREATE POLICY "Créateur peut valider sa transaction"
  ON transaction_headers
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() 
    AND statut = 'brouillon'
  )
  WITH CHECK (
    created_by = auth.uid() 
    AND statut = 'validee'
  );

COMMENT ON POLICY "Créateur peut valider sa transaction" ON transaction_headers IS
  'Permet au créateur de valider sa propre transaction en changeant le statut de brouillon à validee';
