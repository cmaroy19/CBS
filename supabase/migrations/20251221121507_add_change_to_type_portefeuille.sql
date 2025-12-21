/*
  # Ajouter 'change' comme type de portefeuille valide
  
  ## Problème
  Le code frontend utilise 'change' comme type_portefeuille pour les lignes d'équilibrage
  des opérations de change multi-devises, mais la contrainte CHECK de la base de données
  n'accepte que 'cash' et 'virtuel'.
  
  ## Solution
  Mettre à jour la contrainte CHECK pour accepter également 'change' comme type_portefeuille valide.
  
  ## Changes
  1. Supprimer l'ancienne contrainte
  2. Ajouter la nouvelle contrainte avec 'change' inclus
  3. Mettre à jour aussi la contrainte sur transaction_headers si elle existe
*/

-- 1. Mettre à jour la contrainte sur transaction_lines
ALTER TABLE transaction_lines
DROP CONSTRAINT IF EXISTS transaction_lines_type_portefeuille_check;

ALTER TABLE transaction_lines
ADD CONSTRAINT transaction_lines_type_portefeuille_check
CHECK (type_portefeuille = ANY (ARRAY['cash'::text, 'virtuel'::text, 'change'::text]));

-- 2. Ajouter un commentaire pour clarifier l'utilisation de 'change'
COMMENT ON COLUMN transaction_lines.type_portefeuille IS 
  'Type de portefeuille: cash (caisse physique), virtuel (comptes services), change (ligne d''équilibrage pour opérations de change multi-devises)';
