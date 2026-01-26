/*
  # Désactivation du Trigger en Double

  ## Problème
  Deux triggers mettent à jour les soldes :
  1. trigger_update_balances_from_lines (sur INSERT transaction_lines)
  2. trigger_update_balances_on_validation (sur UPDATE transaction_headers)
  
  Cela cause une double mise à jour des soldes.

  ## Solution
  Désactiver trigger_update_balances_from_lines et garder uniquement
  trigger_update_balances_on_validation qui est appelé après la validation.
*/

-- Supprimer le trigger qui cause la double mise à jour
DROP TRIGGER IF EXISTS trigger_update_balances_from_lines ON transaction_lines;

-- Supprimer la fonction associée
DROP FUNCTION IF EXISTS update_balances_from_transaction_lines();

COMMENT ON TRIGGER trigger_update_balances_on_validation ON transaction_headers IS 
  'SEUL trigger actif pour mettre à jour les soldes lors de la validation d''une transaction';
