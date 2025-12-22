/*
  # Ajout des politiques RLS à la vue unifiée

  ## Description
  Ajoute les politiques de sécurité RLS à la vue v_all_transactions
  pour permettre aux utilisateurs authentifiés de lire les transactions.

  ## Politiques
  - Lecture pour tous les utilisateurs authentifiés
*/

-- Activer RLS sur la vue (bien que ce soit une vue, on peut définir des politiques)
-- Note: Les vues héritent des politiques de leurs tables sources

-- Créer une politique de lecture pour la vue
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent lire toutes les transactions" ON v_all_transactions;

-- Alternative: Créer une fonction de sécurité
CREATE OR REPLACE FUNCTION can_read_all_transactions()
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer la vue avec SECURITY INVOKER pour qu'elle utilise les permissions de l'utilisateur
DROP VIEW IF EXISTS v_all_transactions;

CREATE OR REPLACE VIEW v_all_transactions 
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW v_all_transactions IS 'Vue unifiée de toutes les transactions (simples et mixtes) avec security_invoker';
