/*
  # Correction de la logique de mise à jour des soldes

  ## Problème identifié
  Le trigger `update_balances_on_validation` a une logique comptable inversée :
  - Débit augmentait les soldes au lieu de les diminuer
  - Crédit diminuait les soldes au lieu de les augmenter
  
  Et les fonctions mixtes faisaient des UPDATE manuels qui s'ajoutaient au trigger,
  causant des doubles mises à jour incorrectes.

  ## Corrections
  1. Correction de la logique du trigger pour suivre les règles comptables :
     - Pour un RETRAIT (argent qui sort du service et entre dans la caisse) :
       * Débit du service virtuel → diminue le solde du service
       * Crédit du cash → augmente le solde cash
     
     - Pour un DÉPÔT (argent qui sort de la caisse et entre dans le service) :
       * Débit du cash → diminue le solde cash
       * Crédit du service virtuel → augmente le solde du service

  2. Suppression des UPDATE manuels dans les fonctions mixtes pour éviter les doublons
*/

-- Correction du trigger avec la logique comptable correcte
CREATE OR REPLACE FUNCTION update_balances_on_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_line RECORD;
  v_global_balance RECORD;
BEGIN
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN
    
    SELECT * INTO v_global_balance
    FROM global_balances
    LIMIT 1;
    
    IF v_global_balance IS NULL THEN
      INSERT INTO global_balances (cash_usd, cash_cdf)
      VALUES (0, 0)
      RETURNING * INTO v_global_balance;
    END IF;
    
    FOR v_line IN 
      SELECT * FROM transaction_lines
      WHERE header_id = NEW.id
      ORDER BY ligne_numero
    LOOP
      IF v_line.type_portefeuille = 'cash' THEN
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            -- Débit cash = diminution du cash (argent sort de la caisse)
            UPDATE global_balances
            SET cash_usd = cash_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
            -- Crédit cash = augmentation du cash (argent entre dans la caisse)
            UPDATE global_balances
            SET cash_usd = cash_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            -- Débit cash = diminution du cash
            UPDATE global_balances
            SET cash_cdf = cash_cdf - v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
            -- Crédit cash = augmentation du cash
            UPDATE global_balances
            SET cash_cdf = cash_cdf + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          END IF;
        END IF;
        
      ELSIF v_line.type_portefeuille = 'virtuel' AND v_line.service_id IS NOT NULL THEN
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            -- Débit service = diminution du solde service (retrait)
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            -- Crédit service = augmentation du solde service (dépôt)
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf - v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf + v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          END IF;
        END IF;
      ELSIF v_line.type_portefeuille = 'change' THEN
        -- Les lignes de type 'change' ne modifient pas les soldes
        -- Elles servent uniquement à équilibrer la transaction
        CONTINUE;
      END IF;
    END LOOP;
    
    NEW.validated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recréer les fonctions mixtes SANS les UPDATE manuels
CREATE OR REPLACE FUNCTION create_transaction_mixte_retrait(
  p_service_id uuid,
  p_montant_total_usd numeric,
  p_montant_paye_usd numeric,
  p_montant_paye_cdf numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_header_id uuid;
  v_taux_change numeric;
  v_montant_cdf_equivalent numeric;
  v_service_solde numeric;
  v_cash_usd numeric;
  v_cash_cdf numeric;
  v_ligne_numero integer := 1;
BEGIN
  IF p_montant_total_usd <= 0 THEN
    RAISE EXCEPTION 'Le montant total doit être supérieur à zéro';
  END IF;

  IF p_montant_paye_usd < 0 OR p_montant_paye_cdf < 0 THEN
    RAISE EXCEPTION 'Les montants payés ne peuvent pas être négatifs';
  END IF;

  IF p_montant_paye_usd = 0 AND p_montant_paye_cdf = 0 THEN
    RAISE EXCEPTION 'Au moins un montant de paiement doit être supérieur à zéro';
  END IF;

  SELECT solde_virtuel_usd INTO v_service_solde
  FROM services
  WHERE id = p_service_id;

  IF v_service_solde IS NULL THEN
    RAISE EXCEPTION 'Service introuvable';
  END IF;

  IF v_service_solde < p_montant_total_usd THEN
    RAISE EXCEPTION 'Solde virtuel insuffisant. Disponible: % USD', v_service_solde;
  END IF;

  SELECT cash_usd, cash_cdf INTO v_cash_usd, v_cash_cdf
  FROM global_balances
  LIMIT 1;

  v_taux_change := get_active_exchange_rate('USD', 'CDF');

  IF v_taux_change IS NULL THEN
    RAISE EXCEPTION 'Aucun taux de change actif trouvé pour USD/CDF';
  END IF;

  v_montant_cdf_equivalent := (p_montant_total_usd - p_montant_paye_usd) * v_taux_change;

  IF ABS(v_montant_cdf_equivalent - p_montant_paye_cdf) > 0.01 THEN
    RAISE EXCEPTION 'Montant CDF incorrect. Attendu: % CDF pour % USD au taux %',
      ROUND(v_montant_cdf_equivalent, 2),
      (p_montant_total_usd - p_montant_paye_usd),
      v_taux_change;
  END IF;

  INSERT INTO transaction_headers (
    type_operation,
    devise_reference,
    montant_total,
    description,
    info_client,
    taux_change,
    paire_devises,
    statut,
    created_by
  ) VALUES (
    'retrait',
    'USD',
    p_montant_total_usd,
    CASE
      WHEN p_montant_paye_usd > 0 AND p_montant_paye_cdf > 0 THEN
        'Retrait mixte: ' || p_montant_paye_usd || ' USD + ' || p_montant_paye_cdf || ' CDF'
      WHEN p_montant_paye_cdf > 0 THEN
        'Retrait en CDF: ' || p_montant_paye_cdf || ' CDF'
      ELSE
        'Retrait en USD: ' || p_montant_paye_usd || ' USD'
    END,
    p_info_client,
    v_taux_change,
    'USD/CDF',
    'brouillon',
    p_created_by
  ) RETURNING id INTO v_header_id;

  INSERT INTO transaction_lines (
    header_id,
    ligne_numero,
    type_portefeuille,
    service_id,
    devise,
    sens,
    montant,
    description
  ) VALUES (
    v_header_id,
    v_ligne_numero,
    'virtuel',
    p_service_id,
    'USD',
    'debit',
    p_montant_total_usd,
    'Débit service virtuel USD'
  );
  v_ligne_numero := v_ligne_numero + 1;

  IF p_montant_paye_usd > 0 THEN
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'cash',
      NULL,
      'USD',
      'credit',
      p_montant_paye_usd,
      'Crédit cash USD'
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  IF p_montant_paye_cdf > 0 THEN
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'cash',
      NULL,
      'CDF',
      'credit',
      p_montant_paye_cdf,
      'Crédit cash CDF (équivalent ' || ROUND(p_montant_paye_cdf / v_taux_change, 2) || ' USD)'
    );
  END IF;

  PERFORM valider_transaction(v_header_id, p_created_by);

  IF p_notes IS NOT NULL THEN
    UPDATE transaction_headers
    SET description = description || ' - ' || p_notes
    WHERE id = v_header_id;
  END IF;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_transaction_mixte_depot(
  p_service_id uuid,
  p_montant_total_usd numeric,
  p_montant_recu_usd numeric,
  p_montant_recu_cdf numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_header_id uuid;
  v_taux_change numeric;
  v_montant_cdf_equivalent numeric;
  v_cash_usd numeric;
  v_cash_cdf numeric;
  v_ligne_numero integer := 1;
BEGIN
  IF p_montant_total_usd <= 0 THEN
    RAISE EXCEPTION 'Le montant total doit être supérieur à zéro';
  END IF;

  IF p_montant_recu_usd < 0 OR p_montant_recu_cdf < 0 THEN
    RAISE EXCEPTION 'Les montants reçus ne peuvent pas être négatifs';
  END IF;

  IF p_montant_recu_usd = 0 AND p_montant_recu_cdf = 0 THEN
    RAISE EXCEPTION 'Au moins un montant reçu doit être supérieur à zéro';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM services WHERE id = p_service_id) THEN
    RAISE EXCEPTION 'Service introuvable';
  END IF;

  SELECT cash_usd, cash_cdf INTO v_cash_usd, v_cash_cdf
  FROM global_balances
  LIMIT 1;

  v_taux_change := get_active_exchange_rate('USD', 'CDF');

  IF v_taux_change IS NULL THEN
    RAISE EXCEPTION 'Aucun taux de change actif trouvé pour USD/CDF';
  END IF;

  v_montant_cdf_equivalent := (p_montant_total_usd - p_montant_recu_usd) * v_taux_change;

  IF ABS(v_montant_cdf_equivalent - p_montant_recu_cdf) > 0.01 THEN
    RAISE EXCEPTION 'Montant CDF incorrect. Attendu: % CDF pour % USD au taux %',
      ROUND(v_montant_cdf_equivalent, 2),
      (p_montant_total_usd - p_montant_recu_usd),
      v_taux_change;
  END IF;

  INSERT INTO transaction_headers (
    type_operation,
    devise_reference,
    montant_total,
    description,
    info_client,
    taux_change,
    paire_devises,
    statut,
    created_by
  ) VALUES (
    'depot',
    'USD',
    p_montant_total_usd,
    CASE
      WHEN p_montant_recu_usd > 0 AND p_montant_recu_cdf > 0 THEN
        'Dépôt mixte: ' || p_montant_recu_usd || ' USD + ' || p_montant_recu_cdf || ' CDF'
      WHEN p_montant_recu_cdf > 0 THEN
        'Dépôt en CDF: ' || p_montant_recu_cdf || ' CDF'
      ELSE
        'Dépôt en USD: ' || p_montant_recu_usd || ' USD'
    END,
    p_info_client,
    v_taux_change,
    'USD/CDF',
    'brouillon',
    p_created_by
  ) RETURNING id INTO v_header_id;

  IF p_montant_recu_usd > 0 THEN
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'cash',
      NULL,
      'USD',
      'debit',
      p_montant_recu_usd,
      'Débit cash USD'
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  IF p_montant_recu_cdf > 0 THEN
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'cash',
      NULL,
      'CDF',
      'debit',
      p_montant_recu_cdf,
      'Débit cash CDF (équivalent ' || ROUND(p_montant_recu_cdf / v_taux_change, 2) || ' USD)'
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  INSERT INTO transaction_lines (
    header_id,
    ligne_numero,
    type_portefeuille,
    service_id,
    devise,
    sens,
    montant,
    description
  ) VALUES (
    v_header_id,
    v_ligne_numero,
    'virtuel',
    p_service_id,
    'USD',
    'credit',
    p_montant_total_usd,
    'Crédit service virtuel USD'
  );

  PERFORM valider_transaction(v_header_id, p_created_by);

  IF p_notes IS NOT NULL THEN
    UPDATE transaction_headers
    SET description = description || ' - ' || p_notes
    WHERE id = v_header_id;
  END IF;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
