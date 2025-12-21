/*
  # Corriger UPDATE sans WHERE dans fonction atomique

  1. Problème
    - UPDATE global_balances sans WHERE clause
    - Bloqué par RLS Supabase

  2. Solution
    - Ajouter WHERE clause avec condition sur id
    - Utiliser LIMIT 1 dans SELECT pour récupérer l'id
    - UPDATE avec WHERE id = <id_récupéré>

  3. Sécurité
    - Maintient SECURITY DEFINER
    - Maintient toutes les validations
    - Transaction atomique préservée
*/

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS public.create_approvisionnement_atomic;

-- Recréer avec WHERE clauses correctes
CREATE OR REPLACE FUNCTION public.create_approvisionnement_atomic(
  p_type text,
  p_operation text,
  p_service_id uuid,
  p_montant numeric,
  p_devise text,
  p_notes text,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appro_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
  v_global_balance_id uuid;
  v_service_nom text;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur existe et a les permissions
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_created_by 
    AND role IN ('proprietaire', 'gerant')
    AND actif = true
  ) THEN
    RAISE EXCEPTION 'Permission refusée: utilisateur non autorisé';
  END IF;

  -- Validation des paramètres
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être supérieur à zéro';
  END IF;

  IF p_type = 'virtuel' AND p_service_id IS NULL THEN
    RAISE EXCEPTION 'Service requis pour un approvisionnement virtuel';
  END IF;

  IF p_type NOT IN ('cash', 'virtuel') THEN
    RAISE EXCEPTION 'Type invalide: doit être cash ou virtuel';
  END IF;

  IF p_operation NOT IN ('entree', 'sortie') THEN
    RAISE EXCEPTION 'Opération invalide: doit être entree ou sortie';
  END IF;

  IF p_devise NOT IN ('USD', 'CDF') THEN
    RAISE EXCEPTION 'Devise invalide: doit être USD ou CDF';
  END IF;

  -- 1. Insérer l'approvisionnement
  INSERT INTO approvisionnements (
    type, operation, service_id, montant, devise, notes, created_by
  ) VALUES (
    p_type, p_operation, p_service_id, p_montant, p_devise, p_notes, p_created_by
  )
  RETURNING id INTO v_appro_id;

  -- 2. Mettre à jour les soldes selon le type
  IF p_type = 'cash' THEN
    -- Approvisionnement cash → global_balances
    IF p_devise = 'USD' THEN
      -- Récupérer et verrouiller (avec id et solde)
      SELECT id, cash_usd 
      INTO v_global_balance_id, v_current_balance
      FROM global_balances 
      LIMIT 1 
      FOR UPDATE;

      -- Calculer nouveau solde
      v_new_balance := CASE 
        WHEN p_operation = 'entree' THEN v_current_balance + p_montant
        ELSE v_current_balance - p_montant
      END;

      -- Vérifier solde négatif
      IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Solde cash USD insuffisant. Disponible: % USD', v_current_balance;
      END IF;

      -- Mettre à jour AVEC WHERE
      UPDATE global_balances 
      SET cash_usd = v_new_balance
      WHERE id = v_global_balance_id;

    ELSE
      -- CDF
      SELECT id, cash_cdf 
      INTO v_global_balance_id, v_current_balance
      FROM global_balances 
      LIMIT 1 
      FOR UPDATE;

      v_new_balance := CASE 
        WHEN p_operation = 'entree' THEN v_current_balance + p_montant
        ELSE v_current_balance - p_montant
      END;

      IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Solde cash CDF insuffisant. Disponible: % CDF', v_current_balance;
      END IF;

      UPDATE global_balances 
      SET cash_cdf = v_new_balance
      WHERE id = v_global_balance_id;
    END IF;

  ELSE
    -- Approvisionnement virtuel → services
    IF p_devise = 'USD' THEN
      SELECT solde_virtuel_usd, nom 
      INTO v_current_balance, v_service_nom
      FROM services 
      WHERE id = p_service_id 
      FOR UPDATE;

      IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'Service introuvable';
      END IF;

      v_new_balance := CASE 
        WHEN p_operation = 'entree' THEN v_current_balance + p_montant
        ELSE v_current_balance - p_montant
      END;

      IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Solde virtuel USD insuffisant pour %. Disponible: % USD', 
          v_service_nom, v_current_balance;
      END IF;

      UPDATE services 
      SET solde_virtuel_usd = v_new_balance 
      WHERE id = p_service_id;

    ELSE
      -- CDF
      SELECT solde_virtuel_cdf, nom 
      INTO v_current_balance, v_service_nom
      FROM services 
      WHERE id = p_service_id 
      FOR UPDATE;

      IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'Service introuvable';
      END IF;

      v_new_balance := CASE 
        WHEN p_operation = 'entree' THEN v_current_balance + p_montant
        ELSE v_current_balance - p_montant
      END;

      IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Solde virtuel CDF insuffisant pour %. Disponible: % CDF', 
          v_service_nom, v_current_balance;
      END IF;

      UPDATE services 
      SET solde_virtuel_cdf = v_new_balance 
      WHERE id = p_service_id;
    END IF;
  END IF;

  -- Construire le résultat
  v_result := jsonb_build_object(
    'id', v_appro_id,
    'success', true,
    'message', 'Approvisionnement créé avec succès'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION public.create_approvisionnement_atomic TO authenticated;

COMMENT ON FUNCTION public.create_approvisionnement_atomic IS 
  'Crée un approvisionnement de manière atomique avec mise à jour des soldes. Vérifie les permissions et les soldes. CORRIGÉ: avec WHERE clauses.';
