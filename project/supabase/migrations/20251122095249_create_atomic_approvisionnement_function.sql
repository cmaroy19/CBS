/*
  # Créer fonction atomique pour approvisionnements

  1. Fonction SQL
    - `create_approvisionnement_atomic`: Transaction atomique complète
    - Insère l'approvisionnement
    - Met à jour les soldes (cash global ou service virtuel)
    - Vérifie les soldes négatifs AVANT commit
    - Rollback automatique en cas d'erreur
    
  2. Sécurité
    - SECURITY DEFINER pour exécution avec privilèges élevés
    - Vérifie que l'utilisateur est authentifié
    - Vérifie les permissions (gérant/propriétaire)
    - Toutes les opérations dans une seule transaction
    
  3. Avantages
    - Élimine les race conditions
    - Garantit la cohérence des données
    - Performance optimale (1 seul round-trip)
*/

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
  v_solde_key text;
  v_cash_key text;
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

  -- Démarrer la transaction (implicite dans une fonction)
  
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
    v_cash_key := CASE 
      WHEN p_devise = 'USD' THEN 'cash_usd'
      ELSE 'cash_cdf'
    END;

    -- Récupérer et verrouiller la ligne (FOR UPDATE)
    EXECUTE format(
      'SELECT %I FROM global_balances LIMIT 1 FOR UPDATE',
      v_cash_key
    ) INTO v_current_balance;

    -- Calculer nouveau solde
    v_new_balance := CASE 
      WHEN p_operation = 'entree' THEN v_current_balance + p_montant
      ELSE v_current_balance - p_montant
    END;

    -- Vérifier solde négatif
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Solde cash insuffisant. Disponible: % %', v_current_balance, p_devise;
    END IF;

    -- Mettre à jour
    EXECUTE format(
      'UPDATE global_balances SET %I = $1',
      v_cash_key
    ) USING v_new_balance;

  ELSE
    -- Approvisionnement virtuel → services
    v_solde_key := CASE 
      WHEN p_devise = 'USD' THEN 'solde_virtuel_usd'
      ELSE 'solde_virtuel_cdf'
    END;

    -- Récupérer et verrouiller le service (FOR UPDATE)
    EXECUTE format(
      'SELECT %I, nom FROM services WHERE id = $1 FOR UPDATE',
      v_solde_key
    ) INTO v_current_balance, v_service_nom
    USING p_service_id;

    IF v_current_balance IS NULL THEN
      RAISE EXCEPTION 'Service introuvable';
    END IF;

    -- Calculer nouveau solde
    v_new_balance := CASE 
      WHEN p_operation = 'entree' THEN v_current_balance + p_montant
      ELSE v_current_balance - p_montant
    END;

    -- Vérifier solde négatif
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Solde virtuel insuffisant pour %. Disponible: % %', 
        v_service_nom, v_current_balance, p_devise;
    END IF;

    -- Mettre à jour
    EXECUTE format(
      'UPDATE services SET %I = $1 WHERE id = $2',
      v_solde_key
    ) USING v_new_balance, p_service_id;
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
    -- En cas d'erreur, rollback automatique
    RAISE;
END;
$$;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION public.create_approvisionnement_atomic TO authenticated;

-- Créer une politique RLS pour permettre l'appel de la fonction
-- (La fonction elle-même vérifie les permissions)
COMMENT ON FUNCTION public.create_approvisionnement_atomic IS 
  'Crée un approvisionnement de manière atomique avec mise à jour des soldes. Vérifie les permissions et les soldes.';
