/*
  # Correction Finale Retrait CDF avec Lignes de Conversion

  ## Logique correcte
  Pour un retrait de 250,000 CDF payé en 100 USD :
  
  **Transaction lines (pour équilibrer les débits/crédits) :**
  1. Débit virtuel CDF : +250,000
  2. Crédit virtuel CDF : -250,000 (ligne de conversion)
  3. Débit virtuel USD : +100 (ligne de conversion)
  4. Crédit cash USD : -100
  
  **Mise à jour des soldes :**
  - Service virtuel CDF : +250,000 (SEUL le CDF est mis à jour)
  - Service virtuel USD : INCHANGÉ (même si ligne de conversion existe)
  - Cash USD : -100
*/

CREATE OR REPLACE FUNCTION create_transaction_mixte_retrait_cdf(
  p_service_id uuid,
  p_montant_total_cdf numeric,
  p_montant_paye_cdf numeric,
  p_montant_paye_usd numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_header_id uuid;
  v_taux_change numeric;
  v_montant_total_usd numeric;
  v_montant_usd_equivalent numeric;
  v_montant_cdf_equivalent numeric;
  v_service_solde numeric;
  v_cash_usd numeric;
  v_cash_cdf numeric;
  v_ligne_numero integer := 1;
  v_taux_affichage numeric;
BEGIN
  IF p_montant_total_cdf <= 0 THEN
    RAISE EXCEPTION 'Le montant total doit être supérieur à zéro';
  END IF;

  IF p_montant_paye_cdf < 0 OR p_montant_paye_usd < 0 THEN
    RAISE EXCEPTION 'Les montants payés ne peuvent pas être négatifs';
  END IF;

  IF p_montant_paye_cdf = 0 AND p_montant_paye_usd = 0 THEN
    RAISE EXCEPTION 'Au moins un montant de paiement doit être supérieur à zéro';
  END IF;

  v_taux_change := get_active_exchange_rate('CDF', 'USD');

  IF v_taux_change IS NULL THEN
    RAISE EXCEPTION 'Aucun taux de change actif trouvé pour CDF→USD. Veuillez configurer un taux de vente USD.';
  END IF;

  v_taux_affichage := ROUND(1.0 / v_taux_change, 2);
  v_montant_total_usd := p_montant_total_cdf * v_taux_change;

  SELECT solde_virtuel_cdf INTO v_service_solde
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

  v_montant_usd_equivalent := (p_montant_total_cdf - p_montant_paye_cdf) * v_taux_change;

  IF ABS(v_montant_usd_equivalent - p_montant_paye_usd) > 0.01 THEN
    RAISE EXCEPTION 'Montant USD incorrect. Attendu: % USD pour % CDF au taux 1 USD = % CDF (taux interne: 1 CDF = % USD)',
      ROUND(v_montant_usd_equivalent, 2),
      (p_montant_total_cdf - p_montant_paye_cdf),
      v_taux_affichage,
      v_taux_change;
  END IF;

  v_montant_cdf_equivalent := ROUND(p_montant_paye_usd / v_taux_change, 2);

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
    'CDF',
    p_montant_total_cdf,
    CASE
      WHEN p_montant_paye_cdf > 0 AND p_montant_paye_usd > 0 THEN
        'Retrait mixte: ' || p_montant_paye_cdf || ' CDF + ' || p_montant_paye_usd || ' USD'
      WHEN p_montant_paye_usd > 0 THEN
        'Retrait en USD: ' || p_montant_paye_usd || ' USD'
      ELSE
        'Retrait en CDF: ' || p_montant_paye_cdf || ' CDF'
    END,
    p_info_client,
    v_taux_change,
    'CDF/USD',
    'brouillon',
    p_created_by
  ) RETURNING id INTO v_header_id;

  -- Ligne 1: Débit service virtuel CDF (créance augmente)
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
    'CDF',
    'debit',
    p_montant_total_cdf,
    'Débit service virtuel CDF'
  );
  v_ligne_numero := v_ligne_numero + 1;

  -- Ligne 2: Crédit cash CDF si paiement en CDF
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
      'Crédit cash CDF'
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  -- SI paiement en USD, ajouter les lignes de conversion pour équilibrer
  IF p_montant_paye_usd > 0 THEN
    -- Ligne 3: Crédit virtuel CDF (conversion - pour équilibrer)
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
      'CDF',
      'credit',
      v_montant_cdf_equivalent,
      'Crédit service virtuel CDF (conversion de ' || p_montant_paye_usd || ' USD au taux ' || v_taux_affichage || ')'
    );
    v_ligne_numero := v_ligne_numero + 1;

    -- Ligne 4: Débit virtuel USD (conversion - pour équilibrer)
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
      p_montant_paye_usd,
      'Débit service virtuel USD (conversion de ' || v_montant_cdf_equivalent || ' CDF)'
    );
    v_ligne_numero := v_ligne_numero + 1;

    -- Ligne 5: Crédit cash USD
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
  END IF;

  PERFORM valider_transaction(v_header_id, p_created_by);

  -- IMPORTANT: Mettre à jour SEULEMENT le solde virtuel CDF, PAS le USD
  -- Les lignes de conversion USD ne sont là que pour équilibrer la comptabilité
  UPDATE services
  SET
    solde_virtuel_cdf = solde_virtuel_cdf + p_montant_total_cdf,
    updated_at = now()
  WHERE id = p_service_id;

  -- Mise à jour du cash
  UPDATE global_balances
  SET
    cash_usd = cash_usd - p_montant_paye_usd,
    cash_cdf = cash_cdf - p_montant_paye_cdf,
    updated_at = now()
  WHERE id = (SELECT id FROM global_balances LIMIT 1);

  IF p_notes IS NOT NULL THEN
    UPDATE transaction_headers
    SET description = description || ' - ' || p_notes
    WHERE id = v_header_id;
  END IF;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_transaction_mixte_depot_cdf(
  p_service_id uuid,
  p_montant_total_cdf numeric,
  p_montant_recu_cdf numeric,
  p_montant_recu_usd numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_header_id uuid;
  v_taux_change numeric;
  v_montant_total_usd numeric;
  v_montant_usd_equivalent numeric;
  v_montant_cdf_equivalent numeric;
  v_cash_usd numeric;
  v_cash_cdf numeric;
  v_ligne_numero integer := 1;
  v_taux_affichage numeric;
BEGIN
  IF p_montant_total_cdf <= 0 THEN
    RAISE EXCEPTION 'Le montant total doit être supérieur à zéro';
  END IF;

  IF p_montant_recu_cdf < 0 OR p_montant_recu_usd < 0 THEN
    RAISE EXCEPTION 'Les montants reçus ne peuvent pas être négatifs';
  END IF;

  IF p_montant_recu_cdf = 0 AND p_montant_recu_usd = 0 THEN
    RAISE EXCEPTION 'Au moins un montant reçu doit être supérieur à zéro';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM services WHERE id = p_service_id) THEN
    RAISE EXCEPTION 'Service introuvable';
  END IF;

  SELECT cash_usd, cash_cdf INTO v_cash_usd, v_cash_cdf
  FROM global_balances
  LIMIT 1;

  v_taux_change := get_active_exchange_rate('CDF', 'USD');

  IF v_taux_change IS NULL THEN
    RAISE EXCEPTION 'Aucun taux de change actif trouvé pour CDF→USD. Veuillez configurer un taux de vente USD.';
  END IF;

  v_taux_affichage := ROUND(1.0 / v_taux_change, 2);
  v_montant_total_usd := p_montant_total_cdf * v_taux_change;
  v_montant_usd_equivalent := (p_montant_total_cdf - p_montant_recu_cdf) * v_taux_change;

  IF ABS(v_montant_usd_equivalent - p_montant_recu_usd) > 0.01 THEN
    RAISE EXCEPTION 'Montant USD incorrect. Attendu: % USD pour % CDF au taux 1 USD = % CDF (taux interne: 1 CDF = % USD)',
      ROUND(v_montant_usd_equivalent, 2),
      (p_montant_total_cdf - p_montant_recu_cdf),
      v_taux_affichage,
      v_taux_change;
  END IF;

  v_montant_cdf_equivalent := ROUND(p_montant_recu_usd / v_taux_change, 2);

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
    'CDF',
    p_montant_total_cdf,
    CASE
      WHEN p_montant_recu_cdf > 0 AND p_montant_recu_usd > 0 THEN
        'Dépôt mixte: ' || p_montant_recu_cdf || ' CDF + ' || p_montant_recu_usd || ' USD'
      WHEN p_montant_recu_usd > 0 THEN
        'Dépôt en USD: ' || p_montant_recu_usd || ' USD'
      ELSE
        'Dépôt en CDF: ' || p_montant_recu_cdf || ' CDF'
    END,
    p_info_client,
    v_taux_change,
    'CDF/USD',
    'brouillon',
    p_created_by
  ) RETURNING id INTO v_header_id;

  -- Ligne 1: Débit cash CDF si reçu en CDF
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
      'Débit cash CDF'
    );
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  -- SI reçu en USD, ajouter les lignes de conversion pour équilibrer
  IF p_montant_recu_usd > 0 THEN
    -- Ligne 2: Débit virtuel CDF (conversion - pour équilibrer)
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
      'CDF',
      'debit',
      v_montant_cdf_equivalent,
      'Débit service virtuel CDF (conversion de ' || p_montant_recu_usd || ' USD au taux ' || v_taux_affichage || ')'
    );
    v_ligne_numero := v_ligne_numero + 1;

    -- Ligne 3: Crédit virtuel USD (conversion - pour équilibrer)
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
      p_montant_recu_usd,
      'Crédit service virtuel USD (conversion de ' || v_montant_cdf_equivalent || ' CDF)'
    );
    v_ligne_numero := v_ligne_numero + 1;

    -- Ligne 4: Débit cash USD
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

  -- Ligne finale: Crédit service virtuel CDF
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
    'CDF',
    'credit',
    p_montant_total_cdf,
    'Crédit service virtuel CDF'
  );

  PERFORM valider_transaction(v_header_id, p_created_by);

  -- IMPORTANT: Mettre à jour SEULEMENT le solde virtuel CDF, PAS le USD
  -- Les lignes de conversion USD ne sont là que pour équilibrer la comptabilité
  UPDATE services
  SET
    solde_virtuel_cdf = solde_virtuel_cdf - p_montant_total_cdf,
    updated_at = now()
  WHERE id = p_service_id;

  -- Mise à jour du cash
  UPDATE global_balances
  SET
    cash_usd = cash_usd + p_montant_recu_usd,
    cash_cdf = cash_cdf + p_montant_recu_cdf,
    updated_at = now()
  WHERE id = (SELECT id FROM global_balances LIMIT 1);

  IF p_notes IS NOT NULL THEN
    UPDATE transaction_headers
    SET description = description || ' - ' || p_notes
    WHERE id = v_header_id;
  END IF;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_transaction_mixte_retrait_cdf IS 'Retrait CDF mixte - Service virtuel CDF AUGMENTE, Cash DIMINUE. Les lignes de conversion USD servent uniquement à équilibrer la comptabilité double entrée.';
COMMENT ON FUNCTION create_transaction_mixte_depot_cdf IS 'Dépôt CDF mixte - Service virtuel CDF DIMINUE, Cash AUGMENTE. Les lignes de conversion USD servent uniquement à équilibrer la comptabilité double entrée.';
