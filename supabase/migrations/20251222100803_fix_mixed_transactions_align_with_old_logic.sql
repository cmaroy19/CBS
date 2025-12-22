/*
  # Alignement de la logique des transactions mixtes avec le système existant

  ## Analyse de l'ancien système
  
  Dans la table `transactions` avec le trigger `update_soldes_on_transaction` :
  - DEPOT : cash augmente, service virtuel diminue
  - RETRAIT : cash diminue, service virtuel augmente
  
  ## Logique pour transactions mixtes
  
  Pour que le trigger `update_balances_on_validation` fonctionne correctement,
  nous devons utiliser les sens débit/crédit de façon à ce que :
  
  **RETRAIT (transaction_headers.type_operation = 'retrait') :**
  - Service virtuel : sens 'credit' → augmentation du solde (selon le trigger)
  - Cash : sens 'debit' → diminution du cash (selon le trigger)
  
  **DÉPÔT (transaction_headers.type_operation = 'depot') :**
  - Service virtuel : sens 'debit' → diminution du solde (selon le trigger)
  - Cash : sens 'credit' → augmentation du cash (selon le trigger)
  
  Équilibre : total débit = total crédit (en tenant compte de la conversion de devises)
*/

-- Revenir au trigger original avec la logique inversée
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
            -- Débit cash = diminution du cash
            UPDATE global_balances
            SET cash_usd = cash_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
            -- Crédit cash = augmentation du cash
            UPDATE global_balances
            SET cash_usd = cash_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE global_balances
            SET cash_cdf = cash_cdf - v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
            UPDATE global_balances
            SET cash_cdf = cash_cdf + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          END IF;
        END IF;
        
      ELSIF v_line.type_portefeuille = 'virtuel' AND v_line.service_id IS NOT NULL THEN
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            -- Débit service = diminution du solde service
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            -- Crédit service = augmentation du solde service
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
      END IF;
    END LOOP;
    
    NEW.validated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fonction de retrait mixte avec les bons sens
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

  SELECT cash_usd, cash_cdf INTO v_cash_usd, v_cash_cdf
  FROM global_balances
  LIMIT 1;

  IF v_cash_usd < p_montant_paye_usd THEN
    RAISE EXCEPTION 'Solde cash USD insuffisant. Disponible: % USD', v_cash_usd;
  END IF;

  IF v_cash_cdf < p_montant_paye_cdf THEN
    RAISE EXCEPTION 'Solde cash CDF insuffisant. Disponible: % CDF', v_cash_cdf;
  END IF;

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

  -- Ligne 1 : Crédit service virtuel (augmente le solde service selon le trigger)
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
    'Crédit service virtuel USD (retrait client)'
  );
  v_ligne_numero := v_ligne_numero + 1;

  -- Ligne 2 : Débit cash USD (diminue le cash selon le trigger)
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
      'debit',
      p_montant_paye_usd,
      'Débit cash USD (paiement client)'
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  -- Ligne 3 : Débit cash CDF (diminue le cash selon le trigger)
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
      'debit',
      p_montant_paye_cdf,
      'Débit cash CDF (paiement client, équivalent ' || ROUND(p_montant_paye_cdf / v_taux_change, 2) || ' USD)'
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

-- Fonction de dépôt mixte avec les bons sens
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

  -- Ligne 1 : Débit service virtuel (diminue le solde service selon le trigger)
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
    'Débit service virtuel USD (dépôt client)'
  );
  v_ligne_numero := v_ligne_numero + 1;

  -- Ligne 2 : Crédit cash USD (augmente le cash selon le trigger)
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
      'credit',
      p_montant_recu_usd,
      'Crédit cash USD (réception client)'
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  -- Ligne 3 : Crédit cash CDF (augmente le cash selon le trigger)
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
      'credit',
      p_montant_recu_cdf,
      'Crédit cash CDF (réception client, équivalent ' || ROUND(p_montant_recu_cdf / v_taux_change, 2) || ' USD)'
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

COMMENT ON FUNCTION create_transaction_mixte_retrait IS 'Retrait client: crédit service (augmente) + débit cash (diminue)';
COMMENT ON FUNCTION create_transaction_mixte_depot IS 'Dépôt client: débit service (diminue) + crédit cash (augmente)';
