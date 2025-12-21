/*
  # Mise à jour fonction approvisionnement - Support CASH sans service

  1. Modifications
    - Paramètre p_service_id devient nullable (peut être NULL pour cash)
    - Si p_service_id IS NULL → Type = 'cash', mise à jour global_balances
    - Si p_service_id IS NOT NULL → Type = type_compte du service, mise à jour selon type
  
  2. Logique
    - CASH (service_id NULL) → Impact global_balances directement
    - VIRTUEL (service_id fourni + type_compte='virtuel') → Impact solde service
    - CASH via service (service_id fourni + type_compte='cash') → Impact global_balances
  
  3. Sécurité
    - Validations maintenues
    - RLS appliqué
    - Transaction atomique
*/

DROP FUNCTION IF EXISTS create_approvisionnement_atomic(uuid, text, numeric, text, text, uuid);

CREATE FUNCTION create_approvisionnement_atomic(
  p_operation text,
  p_montant numeric,
  p_devise text,
  p_created_by uuid,
  p_service_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appro_id uuid;
  v_type_compte text;
  v_service_nom text;
  v_current_balance numeric;
  v_new_balance numeric;
  v_global_balance_id uuid;
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

  IF p_operation NOT IN ('entree', 'sortie') THEN
    RAISE EXCEPTION 'Opération invalide: doit être entree ou sortie';
  END IF;

  IF p_devise NOT IN ('USD', 'CDF') THEN
    RAISE EXCEPTION 'Devise invalide: doit être USD ou CDF';
  END IF;

  -- Déterminer le type de compte
  IF p_service_id IS NULL THEN
    -- Approvisionnement CASH global (sans service)
    v_type_compte := 'cash';
    v_service_nom := 'Caisse globale';
  ELSE
    -- Approvisionnement via service (récupérer son type)
    SELECT type_compte, nom 
    INTO v_type_compte, v_service_nom
    FROM services 
    WHERE id = p_service_id 
    AND actif = true;

    IF v_type_compte IS NULL THEN
      RAISE EXCEPTION 'Service introuvable ou inactif';
    END IF;
  END IF;

  -- 1. Insérer l'approvisionnement
  INSERT INTO approvisionnements (
    type, operation, service_id, montant, devise, notes, created_by
  ) VALUES (
    v_type_compte, p_operation, p_service_id, p_montant, p_devise, p_notes, p_created_by
  )
  RETURNING id INTO v_appro_id;

  -- 2. Mettre à jour les soldes selon le type
  IF v_type_compte = 'cash' THEN
    -- CASH → Impact global_balances
    IF p_devise = 'USD' THEN
      SELECT id, cash_usd 
      INTO v_global_balance_id, v_current_balance
      FROM global_balances 
      LIMIT 1 
      FOR UPDATE;

      v_new_balance := CASE 
        WHEN p_operation = 'entree' THEN v_current_balance + p_montant
        ELSE v_current_balance - p_montant
      END;

      IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Solde cash USD insuffisant. Disponible: % USD', v_current_balance;
      END IF;

      UPDATE global_balances 
      SET cash_usd = v_new_balance
      WHERE id = v_global_balance_id;

    ELSE -- CDF
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

  ELSE -- VIRTUEL
    -- VIRTUEL → Impact solde virtuel du service
    IF p_devise = 'USD' THEN
      SELECT solde_virtuel_usd 
      INTO v_current_balance
      FROM services 
      WHERE id = p_service_id 
      FOR UPDATE;

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

    ELSE -- CDF
      SELECT solde_virtuel_cdf 
      INTO v_current_balance
      FROM services 
      WHERE id = p_service_id 
      FOR UPDATE;

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
    'type_utilise', v_type_compte,
    'message', format('Approvisionnement %s créé avec succès pour %s', v_type_compte, v_service_nom)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
