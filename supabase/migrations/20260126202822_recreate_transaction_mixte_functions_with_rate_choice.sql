/*
  # Recréation des Fonctions Transaction Mixte avec Choix du Taux

  ## Modifications
  Ajout de 2 nouveaux paramètres optionnels à chaque fonction :
  - p_exchange_rate_mode : 'AUTO' ou 'MANUAL' (défaut: NULL équivaut à AUTO)
  - p_exchange_rate_id : UUID du taux choisi (rempli uniquement si MANUAL)

  ## Logique
  - Mode AUTO (par défaut) : utilise get_active_exchange_rate()
  - Mode MANUAL : charge le taux via l'ID et vérifie qu'il est actif
  - Enregistre le mode et l'ID dans transaction_headers

  ## Conservation
  - Toute la logique comptable reste identique
  - Les lignes de conversion ne changent pas
  - Les mises à jour de soldes restent identiques
*/

-- ============================================================================
-- FONCTION 1: create_transaction_mixte_retrait (RETRAIT USD)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_transaction_mixte_retrait(
  p_service_id uuid,
  p_montant_total_usd numeric,
  p_montant_paye_usd numeric,
  p_montant_paye_cdf numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_exchange_rate_mode text DEFAULT NULL,
  p_exchange_rate_id uuid DEFAULT NULL
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
  v_effective_mode text;
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

  -- Détermination du taux selon le mode
  v_effective_mode := COALESCE(p_exchange_rate_mode, 'AUTO');

  IF v_effective_mode = 'MANUAL' THEN
    IF p_exchange_rate_id IS NULL THEN
      RAISE EXCEPTION 'Un ID de taux doit être fourni en mode MANUAL';
    END IF;

    SELECT taux INTO v_taux_change
    FROM exchange_rates
    WHERE id = p_exchange_rate_id
      AND devise_source = 'USD'
      AND devise_destination = 'CDF'
      AND actif = true;

    IF v_taux_change IS NULL THEN
      RAISE EXCEPTION 'Le taux sélectionné n''existe pas ou n''est pas actif';
    END IF;
  ELSE
    v_taux_change := get_active_exchange_rate('USD', 'CDF');

    IF v_taux_change IS NULL THEN
      RAISE EXCEPTION 'Aucun taux de change actif trouvé pour USD/CDF';
    END IF;
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
    type_operation, devise_reference, montant_total, description, info_client,
    taux_change, paire_devises, exchange_rate_mode, exchange_rate_id, statut, created_by
  ) VALUES (
    'retrait', 'USD', p_montant_total_usd,
    CASE
      WHEN p_montant_paye_usd > 0 AND p_montant_paye_cdf > 0 THEN
        'Retrait mixte: ' || p_montant_paye_usd || ' USD + ' || p_montant_paye_cdf || ' CDF'
      WHEN p_montant_paye_cdf > 0 THEN 'Retrait en CDF: ' || p_montant_paye_cdf || ' CDF'
      ELSE 'Retrait en USD: ' || p_montant_paye_usd || ' USD'
    END,
    p_info_client, v_taux_change, 'USD/CDF', v_effective_mode, p_exchange_rate_id, 'brouillon', p_created_by
  ) RETURNING id INTO v_header_id;

  -- Lignes de transaction (identiques à l'original)
  INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
  VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'USD', 'debit', p_montant_total_usd, 'Débit service virtuel USD', false);
  v_ligne_numero := v_ligne_numero + 1;

  IF p_montant_paye_usd > 0 THEN
    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'cash', NULL, 'USD', 'credit', p_montant_paye_usd, 'Crédit cash USD', false);
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  IF p_montant_paye_cdf > 0 THEN
    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'USD', 'credit', v_montant_usd_equivalent,
      'Crédit service virtuel USD (conversion de ' || p_montant_paye_cdf || ' CDF au taux ' || v_taux_change || ')', true);
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'CDF', 'debit', p_montant_paye_cdf,
      'Débit service virtuel CDF (conversion de ' || v_montant_usd_equivalent || ' USD)', true);
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'cash', NULL, 'CDF', 'credit', p_montant_paye_cdf, 'Crédit cash CDF', false);
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'CDF', 'credit', p_montant_paye_cdf,
      'Crédit service virtuel CDF (annulation conversion)', true);
  END IF;

  PERFORM valider_transaction(v_header_id, p_created_by);

  IF p_notes IS NOT NULL THEN
    UPDATE transaction_headers SET description = description || ' - ' || p_notes WHERE id = v_header_id;
  END IF;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FONCTION 2: create_transaction_mixte_depot (DÉPÔT USD)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_transaction_mixte_depot(
  p_service_id uuid,
  p_montant_total_usd numeric,
  p_montant_recu_usd numeric,
  p_montant_recu_cdf numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_exchange_rate_mode text DEFAULT NULL,
  p_exchange_rate_id uuid DEFAULT NULL
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
  v_effective_mode text;
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

  SELECT cash_usd, cash_cdf INTO v_cash_usd, v_cash_cdf FROM global_balances LIMIT 1;

  v_effective_mode := COALESCE(p_exchange_rate_mode, 'AUTO');

  IF v_effective_mode = 'MANUAL' THEN
    IF p_exchange_rate_id IS NULL THEN
      RAISE EXCEPTION 'Un ID de taux doit être fourni en mode MANUAL';
    END IF;

    SELECT taux INTO v_taux_change
    FROM exchange_rates
    WHERE id = p_exchange_rate_id AND devise_source = 'USD' AND devise_destination = 'CDF' AND actif = true;

    IF v_taux_change IS NULL THEN
      RAISE EXCEPTION 'Le taux sélectionné n''existe pas ou n''est pas actif';
    END IF;
  ELSE
    v_taux_change := get_active_exchange_rate('USD', 'CDF');
    IF v_taux_change IS NULL THEN
      RAISE EXCEPTION 'Aucun taux de change actif trouvé pour USD/CDF';
    END IF;
  END IF;

  v_montant_cdf_equivalent := (p_montant_total_usd - p_montant_recu_usd) * v_taux_change;

  IF ABS(v_montant_cdf_equivalent - p_montant_recu_cdf) > 0.01 THEN
    RAISE EXCEPTION 'Montant CDF incorrect. Attendu: % CDF pour % USD au taux %',
      ROUND(v_montant_cdf_equivalent, 2), (p_montant_total_usd - p_montant_recu_usd), v_taux_change;
  END IF;

  v_montant_usd_equivalent := ROUND(p_montant_recu_cdf / v_taux_change, 2);

  INSERT INTO transaction_headers (
    type_operation, devise_reference, montant_total, description, info_client,
    taux_change, paire_devises, exchange_rate_mode, exchange_rate_id, statut, created_by
  ) VALUES (
    'depot', 'USD', p_montant_total_usd,
    CASE
      WHEN p_montant_recu_usd > 0 AND p_montant_recu_cdf > 0 THEN
        'Dépôt mixte: ' || p_montant_recu_usd || ' USD + ' || p_montant_recu_cdf || ' CDF'
      WHEN p_montant_recu_cdf > 0 THEN 'Dépôt en CDF: ' || p_montant_recu_cdf || ' CDF'
      ELSE 'Dépôt en USD: ' || p_montant_recu_usd || ' USD'
    END,
    p_info_client, v_taux_change, 'USD/CDF', v_effective_mode, p_exchange_rate_id, 'brouillon', p_created_by
  ) RETURNING id INTO v_header_id;

  IF p_montant_recu_usd > 0 THEN
    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'cash', NULL, 'USD', 'debit', p_montant_recu_usd, 'Débit cash USD', false);
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  IF p_montant_recu_cdf > 0 THEN
    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'USD', 'debit', v_montant_usd_equivalent,
      'Débit service virtuel USD (conversion de ' || p_montant_recu_cdf || ' CDF au taux ' || v_taux_change || ')', true);
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'CDF', 'credit', p_montant_recu_cdf,
      'Crédit service virtuel CDF (conversion de ' || v_montant_usd_equivalent || ' USD)', true);
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'cash', NULL, 'CDF', 'debit', p_montant_recu_cdf, 'Débit cash CDF', false);
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'CDF', 'debit', p_montant_recu_cdf,
      'Débit service virtuel CDF (annulation conversion)', true);
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description, is_conversion_line)
  VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'USD', 'credit', p_montant_total_usd, 'Crédit service virtuel USD', false);

  PERFORM valider_transaction(v_header_id, p_created_by);

  IF p_notes IS NOT NULL THEN
    UPDATE transaction_headers SET description = description || ' - ' || p_notes WHERE id = v_header_id;
  END IF;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FONCTION 3: create_transaction_mixte_retrait_cdf (RETRAIT CDF)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_transaction_mixte_retrait_cdf(
  p_service_id uuid,
  p_montant_total_cdf numeric,
  p_montant_paye_cdf numeric,
  p_montant_paye_usd numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_exchange_rate_mode text DEFAULT NULL,
  p_exchange_rate_id uuid DEFAULT NULL
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
  v_effective_mode text;
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

  v_effective_mode := COALESCE(p_exchange_rate_mode, 'AUTO');

  IF v_effective_mode = 'MANUAL' THEN
    IF p_exchange_rate_id IS NULL THEN
      RAISE EXCEPTION 'Un ID de taux doit être fourni en mode MANUAL';
    END IF;

    SELECT taux INTO v_taux_change
    FROM exchange_rates
    WHERE id = p_exchange_rate_id AND devise_source = 'CDF' AND devise_destination = 'USD' AND actif = true;

    IF v_taux_change IS NULL THEN
      RAISE EXCEPTION 'Le taux sélectionné n''existe pas ou n''est pas actif';
    END IF;
  ELSE
    v_taux_change := get_active_exchange_rate('CDF', 'USD');
    IF v_taux_change IS NULL THEN
      RAISE EXCEPTION 'Aucun taux de change actif trouvé pour CDF→USD. Veuillez configurer un taux de vente USD.';
    END IF;
  END IF;

  v_taux_affichage := ROUND(1.0 / v_taux_change, 2);
  v_montant_total_usd := p_montant_total_cdf * v_taux_change;

  SELECT solde_virtuel_cdf INTO v_service_solde FROM services WHERE id = p_service_id;
  IF v_service_solde IS NULL THEN
    RAISE EXCEPTION 'Service introuvable';
  END IF;

  SELECT cash_usd, cash_cdf INTO v_cash_usd, v_cash_cdf FROM global_balances LIMIT 1;

  IF v_cash_usd < p_montant_paye_usd THEN
    RAISE EXCEPTION 'Solde cash USD insuffisant. Disponible: % USD', v_cash_usd;
  END IF;

  IF v_cash_cdf < p_montant_paye_cdf THEN
    RAISE EXCEPTION 'Solde cash CDF insuffisant. Disponible: % CDF', v_cash_cdf;
  END IF;

  v_montant_usd_equivalent := (p_montant_total_cdf - p_montant_paye_cdf) * v_taux_change;

  IF ABS(v_montant_usd_equivalent - p_montant_paye_usd) > 0.01 THEN
    RAISE EXCEPTION 'Montant USD incorrect. Attendu: % USD pour % CDF au taux 1 USD = % CDF (taux interne: 1 CDF = % USD)',
      ROUND(v_montant_usd_equivalent, 2), (p_montant_total_cdf - p_montant_paye_cdf), v_taux_affichage, v_taux_change;
  END IF;

  v_montant_cdf_equivalent := ROUND(p_montant_paye_usd / v_taux_change, 2);

  INSERT INTO transaction_headers (
    type_operation, devise_reference, montant_total, description, info_client,
    taux_change, paire_devises, exchange_rate_mode, exchange_rate_id, statut, created_by
  ) VALUES (
    'retrait', 'CDF', p_montant_total_cdf,
    CASE
      WHEN p_montant_paye_cdf > 0 AND p_montant_paye_usd > 0 THEN
        'Retrait mixte: ' || p_montant_paye_cdf || ' CDF + ' || p_montant_paye_usd || ' USD'
      WHEN p_montant_paye_usd > 0 THEN 'Retrait en USD: ' || p_montant_paye_usd || ' USD'
      ELSE 'Retrait en CDF: ' || p_montant_paye_cdf || ' CDF'
    END,
    p_info_client, v_taux_change, 'CDF/USD', v_effective_mode, p_exchange_rate_id, 'brouillon', p_created_by
  ) RETURNING id INTO v_header_id;

  INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
  VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'CDF', 'debit', p_montant_total_cdf, 'Débit service virtuel CDF');
  v_ligne_numero := v_ligne_numero + 1;

  IF p_montant_paye_cdf > 0 THEN
    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
    VALUES (v_header_id, v_ligne_numero, 'cash', NULL, 'CDF', 'credit', p_montant_paye_cdf, 'Crédit cash CDF');
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  IF p_montant_paye_usd > 0 THEN
    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'CDF', 'credit', v_montant_cdf_equivalent,
      'Crédit service virtuel CDF (conversion de ' || p_montant_paye_usd || ' USD au taux ' || v_taux_affichage || ')');
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'USD', 'debit', p_montant_paye_usd,
      'Débit service virtuel USD (conversion de ' || v_montant_cdf_equivalent || ' CDF)');
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
    VALUES (v_header_id, v_ligne_numero, 'cash', NULL, 'USD', 'credit', p_montant_paye_usd, 'Crédit cash USD');
  END IF;

  PERFORM valider_transaction(v_header_id, p_created_by);

  UPDATE services
  SET solde_virtuel_cdf = solde_virtuel_cdf + p_montant_total_cdf, updated_at = now()
  WHERE id = p_service_id;

  UPDATE global_balances
  SET cash_usd = cash_usd - p_montant_paye_usd, cash_cdf = cash_cdf - p_montant_paye_cdf, updated_at = now()
  WHERE id = (SELECT id FROM global_balances LIMIT 1);

  IF p_notes IS NOT NULL THEN
    UPDATE transaction_headers SET description = description || ' - ' || p_notes WHERE id = v_header_id;
  END IF;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FONCTION 4: create_transaction_mixte_depot_cdf (DÉPÔT CDF)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_transaction_mixte_depot_cdf(
  p_service_id uuid,
  p_montant_total_cdf numeric,
  p_montant_recu_cdf numeric,
  p_montant_recu_usd numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_exchange_rate_mode text DEFAULT NULL,
  p_exchange_rate_id uuid DEFAULT NULL
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
  v_effective_mode text;
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

  SELECT cash_usd, cash_cdf INTO v_cash_usd, v_cash_cdf FROM global_balances LIMIT 1;

  v_effective_mode := COALESCE(p_exchange_rate_mode, 'AUTO');

  IF v_effective_mode = 'MANUAL' THEN
    IF p_exchange_rate_id IS NULL THEN
      RAISE EXCEPTION 'Un ID de taux doit être fourni en mode MANUAL';
    END IF;

    SELECT taux INTO v_taux_change
    FROM exchange_rates
    WHERE id = p_exchange_rate_id AND devise_source = 'CDF' AND devise_destination = 'USD' AND actif = true;

    IF v_taux_change IS NULL THEN
      RAISE EXCEPTION 'Le taux sélectionné n''existe pas ou n''est pas actif';
    END IF;
  ELSE
    v_taux_change := get_active_exchange_rate('CDF', 'USD');
    IF v_taux_change IS NULL THEN
      RAISE EXCEPTION 'Aucun taux de change actif trouvé pour CDF→USD. Veuillez configurer un taux de vente USD.';
    END IF;
  END IF;

  v_taux_affichage := ROUND(1.0 / v_taux_change, 2);
  v_montant_total_usd := p_montant_total_cdf * v_taux_change;
  v_montant_usd_equivalent := (p_montant_total_cdf - p_montant_recu_cdf) * v_taux_change;

  IF ABS(v_montant_usd_equivalent - p_montant_recu_usd) > 0.01 THEN
    RAISE EXCEPTION 'Montant USD incorrect. Attendu: % USD pour % CDF au taux 1 USD = % CDF (taux interne: 1 CDF = % USD)',
      ROUND(v_montant_usd_equivalent, 2), (p_montant_total_cdf - p_montant_recu_cdf), v_taux_affichage, v_taux_change;
  END IF;

  v_montant_cdf_equivalent := ROUND(p_montant_recu_usd / v_taux_change, 2);

  INSERT INTO transaction_headers (
    type_operation, devise_reference, montant_total, description, info_client,
    taux_change, paire_devises, exchange_rate_mode, exchange_rate_id, statut, created_by
  ) VALUES (
    'depot', 'CDF', p_montant_total_cdf,
    CASE
      WHEN p_montant_recu_cdf > 0 AND p_montant_recu_usd > 0 THEN
        'Dépôt mixte: ' || p_montant_recu_cdf || ' CDF + ' || p_montant_recu_usd || ' USD'
      WHEN p_montant_recu_usd > 0 THEN 'Dépôt en USD: ' || p_montant_recu_usd || ' USD'
      ELSE 'Dépôt en CDF: ' || p_montant_recu_cdf || ' CDF'
    END,
    p_info_client, v_taux_change, 'CDF/USD', v_effective_mode, p_exchange_rate_id, 'brouillon', p_created_by
  ) RETURNING id INTO v_header_id;

  IF p_montant_recu_cdf > 0 THEN
    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
    VALUES (v_header_id, v_ligne_numero, 'cash', NULL, 'CDF', 'debit', p_montant_recu_cdf, 'Débit cash CDF');
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  IF p_montant_recu_usd > 0 THEN
    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'CDF', 'debit', v_montant_cdf_equivalent,
      'Débit service virtuel CDF (conversion de ' || p_montant_recu_usd || ' USD au taux ' || v_taux_affichage || ')');
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
    VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'USD', 'credit', p_montant_recu_usd,
      'Crédit service virtuel USD (conversion de ' || v_montant_cdf_equivalent || ' CDF)');
    v_ligne_numero := v_ligne_numero + 1;

    INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
    VALUES (v_header_id, v_ligne_numero, 'cash', NULL, 'USD', 'debit', p_montant_recu_usd, 'Débit cash USD');
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, service_id, devise, sens, montant, description)
  VALUES (v_header_id, v_ligne_numero, 'virtuel', p_service_id, 'CDF', 'credit', p_montant_total_cdf, 'Crédit service virtuel CDF');

  PERFORM valider_transaction(v_header_id, p_created_by);

  UPDATE services
  SET solde_virtuel_cdf = solde_virtuel_cdf - p_montant_total_cdf, updated_at = now()
  WHERE id = p_service_id;

  UPDATE global_balances
  SET cash_usd = cash_usd + p_montant_recu_usd, cash_cdf = cash_cdf + p_montant_recu_cdf, updated_at = now()
  WHERE id = (SELECT id FROM global_balances LIMIT 1);

  IF p_notes IS NOT NULL THEN
    UPDATE transaction_headers SET description = description || ' - ' || p_notes WHERE id = v_header_id;
  END IF;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_transaction_mixte_retrait IS 'Retrait USD mixte avec choix du taux (AUTO/MANUAL). Les soldes sont mis à jour par trigger.';
COMMENT ON FUNCTION create_transaction_mixte_depot IS 'Dépôt USD mixte avec choix du taux (AUTO/MANUAL). Les soldes sont mis à jour par trigger.';
COMMENT ON FUNCTION create_transaction_mixte_retrait_cdf IS 'Retrait CDF mixte avec choix du taux (AUTO/MANUAL). Mise à jour manuelle des soldes (virtuel CDF + cash).';
COMMENT ON FUNCTION create_transaction_mixte_depot_cdf IS 'Dépôt CDF mixte avec choix du taux (AUTO/MANUAL). Mise à jour manuelle des soldes (virtuel CDF + cash).';
