/*
  # Correction du sens débit/crédit dans les transactions mixtes

  ## Problème
  Les fonctions mixtes utilisaient les mauvais sens (débit/crédit) pour les lignes cash :
  
  - RETRAIT : mettait CRÉDIT cash alors qu'on PAIE le client (cash sort = DÉBIT)
  - DÉPÔT : mettait DÉBIT cash alors qu'on REÇOIT l'argent (cash entre = CRÉDIT)

  ## Logique correcte

  ### Pour un RETRAIT (client retire de son compte virtuel)
  1. Service virtuel : DÉBIT (montant sort du service)
  2. Cash : DÉBIT (on paie le client, argent sort de la caisse)
  
  Effet sur les soldes (via trigger) :
  - Débit service → solde service diminue ✓
  - Débit cash → solde cash diminue ✓

  ### Pour un DÉPÔT (client dépose dans son compte virtuel)
  1. Cash : CRÉDIT (on reçoit l'argent, entre dans la caisse)
  2. Service virtuel : CRÉDIT (montant entre dans le service)
  
  Effet sur les soldes (via trigger) :
  - Crédit cash → solde cash augmente ✓
  - Crédit service → solde service augmente ✓
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

  -- Ligne 1 : Débit du service virtuel (argent sort du service)
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

  -- Ligne 2 : Débit cash USD (on paie le client, argent sort de la caisse)
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

  -- Ligne 3 : Débit cash CDF (on paie le client, argent sort de la caisse)
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

  -- Ligne 1 : Crédit cash USD (on reçoit l'argent, entre dans la caisse)
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

  -- Ligne 2 : Crédit cash CDF (on reçoit l'argent, entre dans la caisse)
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
    v_ligne_numero := v_ligne_numero + 1;
  END IF;

  -- Ligne 3 : Crédit service virtuel (montant entre dans le service)
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

COMMENT ON FUNCTION create_transaction_mixte_retrait IS 'Crée une transaction de retrait avec paiement mixte USD/CDF - Débit service et cash';
COMMENT ON FUNCTION create_transaction_mixte_depot IS 'Crée une transaction de dépôt avec réception mixte USD/CDF - Crédit service et cash';
