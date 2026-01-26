/*
  # Correction Retrait USD - Suppression Ligne de Conversion en Trop

  ## Problème
  La fonction créait une ligne de conversion CDF en trop (ligne 6) qui
  causait un déséquilibre : débits=20700, crédits=41400.

  ## Solution
  Supprimer la ligne 6 qui n'est pas nécessaire car les lignes 4 et 5
  s'équilibrent déjà (débit CDF 20,700 + crédit CDF 20,700 = 0).
*/

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
  v_montant_usd_equivalent numeric;
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

  v_montant_usd_equivalent := ROUND(p_montant_paye_cdf / v_taux_change, 2);

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

  -- Ligne 1: Débit service virtuel USD (créance augmente)
  INSERT INTO transaction_lines (
    header_id,
    ligne_numero,
    type_portefeuille,
    service_id,
    devise,
    sens,
    montant,
    description,
    is_conversion_line
  ) VALUES (
    v_header_id,
    v_ligne_numero,
    'virtuel',
    p_service_id,
    'USD',
    'debit',
    p_montant_total_usd,
    'Débit service virtuel USD',
    false
  );
  v_ligne_numero := v_ligne_numero + 1;

  -- Ligne 2: Crédit cash USD si paiement en USD
  IF p_montant_paye_usd > 0 THEN
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description,
      is_conversion_line
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'cash',
      NULL,
      'USD',
      'credit',
      p_montant_paye_usd,
      'Crédit cash USD',
      false
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  -- SI paiement en CDF, ajouter les lignes de conversion pour équilibrer
  IF p_montant_paye_cdf > 0 THEN
    -- Ligne 3: Crédit virtuel USD (conversion - pour équilibrer) - IGNORÉE PAR TRIGGER
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description,
      is_conversion_line
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'virtuel',
      p_service_id,
      'USD',
      'credit',
      v_montant_usd_equivalent,
      'Crédit service virtuel USD (conversion de ' || p_montant_paye_cdf || ' CDF au taux ' || v_taux_change || ')',
      true
    );
    v_ligne_numero := v_ligne_numero + 1;

    -- Ligne 4: Débit virtuel CDF (conversion - pour équilibrer) - IGNORÉE PAR TRIGGER
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description,
      is_conversion_line
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'virtuel',
      p_service_id,
      'CDF',
      'debit',
      p_montant_paye_cdf,
      'Débit service virtuel CDF (conversion de ' || v_montant_usd_equivalent || ' USD)',
      true
    );
    v_ligne_numero := v_ligne_numero + 1;

    -- Ligne 5: Crédit cash CDF
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description,
      is_conversion_line
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'cash',
      NULL,
      'CDF',
      'credit',
      p_montant_paye_cdf,
      'Crédit cash CDF',
      false
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
  v_montant_usd_equivalent numeric;
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

  v_montant_usd_equivalent := ROUND(p_montant_recu_cdf / v_taux_change, 2);

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

  -- Ligne 1: Débit cash USD si reçu en USD
  IF p_montant_recu_usd > 0 THEN
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description,
      is_conversion_line
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'cash',
      NULL,
      'USD',
      'debit',
      p_montant_recu_usd,
      'Débit cash USD',
      false
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  -- SI reçu en CDF, ajouter les lignes de conversion pour équilibrer
  IF p_montant_recu_cdf > 0 THEN
    -- Ligne 2: Débit virtuel USD (conversion - pour équilibrer) - IGNORÉE PAR TRIGGER
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description,
      is_conversion_line
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'virtuel',
      p_service_id,
      'USD',
      'debit',
      v_montant_usd_equivalent,
      'Débit service virtuel USD (conversion de ' || p_montant_recu_cdf || ' CDF au taux ' || v_taux_change || ')',
      true
    );
    v_ligne_numero := v_ligne_numero + 1;

    -- Ligne 3: Crédit virtuel CDF (conversion - pour équilibrer) - IGNORÉE PAR TRIGGER
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description,
      is_conversion_line
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'virtuel',
      p_service_id,
      'CDF',
      'credit',
      p_montant_recu_cdf,
      'Crédit service virtuel CDF (conversion de ' || v_montant_usd_equivalent || ' USD)',
      true
    );
    v_ligne_numero := v_ligne_numero + 1;

    -- Ligne 4: Débit cash CDF
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description,
      is_conversion_line
    ) VALUES (
      v_header_id,
      v_ligne_numero,
      'cash',
      NULL,
      'CDF',
      'debit',
      p_montant_recu_cdf,
      'Débit cash CDF',
      false
    );
  END IF;

  -- Ligne finale: Crédit service virtuel USD
  INSERT INTO transaction_lines (
    header_id,
    ligne_numero,
    type_portefeuille,
    service_id,
    devise,
    sens,
    montant,
    description,
    is_conversion_line
  ) VALUES (
    v_header_id,
    v_ligne_numero,
    'virtuel',
    p_service_id,
    'USD',
    'credit',
    p_montant_total_usd,
    'Crédit service virtuel USD',
    false
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
