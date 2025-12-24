/*
  # Mise à jour de la vue v_all_transactions avec les colonnes de correction

  1. Modifications
    - Ajoute les colonnes de correction pour les transaction_headers
    - Filtre les transactions annulées des transaction_headers
    - Maintient la compatibilité avec les transactions simples

  2. Colonnes ajoutées
    - transaction_origine_id (pour les deux types)
    - raison_correction (pour les deux types)
    - corrigee_par (pour les deux types)
    - corrigee_le (pour les deux types)
*/

-- Recréer la vue avec toutes les colonnes de correction
CREATE OR REPLACE VIEW v_all_transactions AS
-- Anciennes transactions simples
SELECT 
  t.id,
  t.reference,
  t.type,
  t.service_id,
  t.montant,
  t.devise,
  t.info_client,
  t.notes as notes,
  t.created_by,
  t.created_at,
  false as is_mixed,
  NULL::numeric as taux_change,
  NULL::text as description,
  t.annule,
  t.transaction_origine_id,
  t.raison_correction,
  t.corrigee_par,
  t.corrigee_le,
  'transactions'::text as table_source
FROM transactions t
WHERE t.annule = false OR t.annule IS NULL

UNION ALL

-- Nouvelles transactions multi-lignes
SELECT 
  h.id,
  h.reference,
  h.type_operation as type,
  -- Extraire le service_id de la première ligne avec un service
  (SELECT l.service_id 
   FROM transaction_lines l 
   WHERE l.header_id = h.id AND l.service_id IS NOT NULL 
   LIMIT 1) as service_id,
  h.montant_total as montant,
  h.devise_reference as devise,
  h.info_client,
  h.description as notes,
  h.created_by,
  h.created_at,
  CASE WHEN h.taux_change IS NOT NULL THEN true ELSE false END as is_mixed,
  h.taux_change,
  h.description,
  CASE WHEN h.statut = 'annulee' THEN true ELSE false END as annule,
  h.transaction_origine_id,
  h.raison_correction,
  h.corrigee_par,
  h.corrigee_le,
  'transaction_headers'::text as table_source
FROM transaction_headers h
WHERE h.statut = 'validee' OR h.statut = 'annulee'

ORDER BY created_at DESC;

COMMENT ON VIEW v_all_transactions IS 'Vue unifiée de toutes les transactions (simples et mixtes) avec support de correction';
