/*
  # Vue unifiée des transactions (anciennes + nouvelles)

  ## Description
  Crée une vue qui combine :
  - Les anciennes transactions simples (table transactions)
  - Les nouvelles transactions multi-lignes (table transaction_headers)
  
  Cela permet d'afficher tous les types de transactions dans l'interface.

  ## Vue: v_all_transactions
  
  Colonnes communes :
  - id
  - reference
  - type (depot/retrait)
  - service_id
  - montant (montant total en devise de référence)
  - devise
  - info_client
  - notes
  - created_by
  - created_at
  - is_mixed (boolean pour distinguer les transactions mixtes)
  - taux_change (pour les transactions mixtes)
  - description (détails du paiement mixte)
*/

-- Vue unifiée de toutes les transactions
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
  t.corrigee_le
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
  false as annule,
  NULL::uuid as transaction_origine_id,
  NULL::text as raison_correction,
  NULL::uuid as corrigee_par,
  NULL::timestamptz as corrigee_le
FROM transaction_headers h
WHERE h.statut = 'validee'

ORDER BY created_at DESC;

-- Ajouter les permissions RLS
COMMENT ON VIEW v_all_transactions IS 'Vue unifiée de toutes les transactions (simples et mixtes)';
