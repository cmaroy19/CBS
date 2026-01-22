/*
  # Système de Taux de Change Bidirectionnels Distincts

  ## Description
  Cette migration améliore le système de taux de change pour supporter deux taux distincts
  actifs simultanément pour les paires USD/CDF et CDF/USD.

  ### Contexte
  Précédemment, le système permettait un seul taux actif par paire et cherchait automatiquement
  l'inverse (1/taux) si le sens demandé n'existait pas. Cette approche ne permettait pas de
  gérer des taux d'achat et de vente différents.

  ### Nouveau Comportement
  - **USD → CDF** : Taux d'achat USD (ex: 1 USD = 2200 CDF)
  - **CDF → USD** : Taux de vente USD (ex: 1 USD = 2250 CDF, donc 1 CDF = 1/2250 USD)

  Les deux taux peuvent être actifs simultanément, permettant ainsi d'avoir :
  - Une marge commerciale entre achat et vente
  - Des taux distincts selon le sens de la conversion

  ## Modifications

  ### 1. Fonction get_active_exchange_rate
  - Ne cherche PLUS l'inverse automatiquement
  - Retourne uniquement le taux exact pour la paire demandée
  - Retourne NULL si aucun taux actif n'existe pour cette direction

  ### 2. Fonction get_exchange_rate_with_fallback (legacy)
  - Conserve l'ancien comportement (cherche l'inverse)
  - Pour compatibilité si nécessaire
  - NON utilisée par défaut

  ### 3. Vue v_active_exchange_rates_bidirectional
  - Affiche tous les taux actifs avec indication du sens
  - Facilite la visualisation des taux configurés

  ## Exemples d'utilisation

  ### Configuration de deux taux distincts
  ```sql
  -- Taux d'achat USD (vente CDF) : 1 USD = 2200 CDF
  INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
  VALUES ('USD', 'CDF', 2200, true, 'Taux achat USD - vente CDF');

  -- Taux de vente USD (achat CDF) : 1 USD = 2250 CDF (soit 1 CDF = 1/2250 USD)
  INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
  VALUES ('CDF', 'USD', 0.000444444, true, 'Taux vente USD - achat CDF (1/2250)');
  ```
*/

-- Sauvegarde de l'ancienne fonction avec un nouveau nom (pour compatibilité si nécessaire)
CREATE OR REPLACE FUNCTION get_exchange_rate_with_fallback(
  p_devise_source text,
  p_devise_destination text
)
RETURNS numeric AS $$
DECLARE
  v_taux numeric;
BEGIN
  SELECT taux INTO v_taux
  FROM exchange_rates
  WHERE devise_source = p_devise_source
  AND devise_destination = p_devise_destination
  AND actif = true
  AND date_debut <= now()
  AND (date_fin IS NULL OR date_fin > now())
  LIMIT 1;

  IF v_taux IS NULL THEN
    SELECT (1.0 / taux) INTO v_taux
    FROM exchange_rates
    WHERE devise_source = p_devise_destination
    AND devise_destination = p_devise_source
    AND actif = true
    AND date_debut <= now()
    AND (date_fin IS NULL OR date_fin > now())
    LIMIT 1;
  END IF;

  RETURN v_taux;
END;
$$ LANGUAGE plpgsql;

-- Redéfinition de get_active_exchange_rate : ne cherche PLUS l'inverse automatiquement
CREATE OR REPLACE FUNCTION get_active_exchange_rate(
  p_devise_source text,
  p_devise_destination text
)
RETURNS numeric AS $$
DECLARE
  v_taux numeric;
BEGIN
  SELECT taux INTO v_taux
  FROM exchange_rates
  WHERE devise_source = p_devise_source
  AND devise_destination = p_devise_destination
  AND actif = true
  AND date_debut <= now()
  AND (date_fin IS NULL OR date_fin > now())
  LIMIT 1;

  RETURN v_taux;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si les deux sens de conversion sont configurés
CREATE OR REPLACE FUNCTION check_bidirectional_rates_configured()
RETURNS TABLE(
  usd_to_cdf_configured boolean,
  cdf_to_usd_configured boolean,
  usd_to_cdf_rate numeric,
  cdf_to_usd_rate numeric,
  both_configured boolean
) AS $$
DECLARE
  v_usd_to_cdf numeric;
  v_cdf_to_usd numeric;
BEGIN
  v_usd_to_cdf := get_active_exchange_rate('USD', 'CDF');
  v_cdf_to_usd := get_active_exchange_rate('CDF', 'USD');

  RETURN QUERY SELECT
    v_usd_to_cdf IS NOT NULL AS usd_to_cdf_configured,
    v_cdf_to_usd IS NOT NULL AS cdf_to_usd_configured,
    v_usd_to_cdf AS usd_to_cdf_rate,
    v_cdf_to_usd AS cdf_to_usd_rate,
    (v_usd_to_cdf IS NOT NULL AND v_cdf_to_usd IS NOT NULL) AS both_configured;
END;
$$ LANGUAGE plpgsql;

-- Vue améliorée pour afficher tous les taux actifs bidirectionnels
DROP VIEW IF EXISTS v_active_exchange_rates;
CREATE OR REPLACE VIEW v_active_exchange_rates AS
SELECT
  id,
  devise_source,
  devise_destination,
  CASE
    WHEN devise_source = 'USD' AND devise_destination = 'CDF' THEN 'Achat USD / Vente CDF'
    WHEN devise_source = 'CDF' AND devise_destination = 'USD' THEN 'Vente USD / Achat CDF'
    ELSE devise_source || ' → ' || devise_destination
  END AS sens_conversion,
  taux,
  CASE
    WHEN devise_source = 'USD' AND devise_destination = 'CDF' THEN
      '1 USD = ' || taux || ' CDF'
    WHEN devise_source = 'CDF' AND devise_destination = 'USD' THEN
      '1 CDF = ' || taux || ' USD (équiv: 1 USD = ' || ROUND(1.0 / taux, 2) || ' CDF)'
    ELSE taux::text
  END AS formule_conversion,
  date_debut,
  date_fin,
  notes,
  created_by,
  created_at
FROM exchange_rates
WHERE actif = true
AND date_debut <= now()
AND (date_fin IS NULL OR date_fin > now())
ORDER BY
  CASE devise_source
    WHEN 'USD' THEN 1
    WHEN 'CDF' THEN 2
    ELSE 3
  END,
  devise_destination;

-- Vue pour faciliter la consultation des taux bidirectionnels
CREATE OR REPLACE VIEW v_exchange_rates_summary AS
SELECT
  usd_to_cdf.taux AS taux_usd_to_cdf,
  cdf_to_usd.taux AS taux_cdf_to_usd,
  CASE
    WHEN usd_to_cdf.taux IS NOT NULL AND cdf_to_usd.taux IS NOT NULL THEN
      ROUND((1.0 / cdf_to_usd.taux) - usd_to_cdf.taux, 2)
    ELSE NULL
  END AS ecart_taux,
  CASE
    WHEN usd_to_cdf.taux IS NOT NULL AND cdf_to_usd.taux IS NOT NULL THEN
      ROUND((((1.0 / cdf_to_usd.taux) - usd_to_cdf.taux) / usd_to_cdf.taux * 100), 2)
    ELSE NULL
  END AS marge_pct,
  usd_to_cdf.date_debut AS usd_to_cdf_date_debut,
  cdf_to_usd.date_debut AS cdf_to_usd_date_debut,
  usd_to_cdf.notes AS usd_to_cdf_notes,
  cdf_to_usd.notes AS cdf_to_usd_notes
FROM
  (SELECT taux, date_debut, notes FROM exchange_rates
   WHERE devise_source = 'USD' AND devise_destination = 'CDF' AND actif = true
   LIMIT 1) AS usd_to_cdf
FULL OUTER JOIN
  (SELECT taux, date_debut, notes FROM exchange_rates
   WHERE devise_source = 'CDF' AND devise_destination = 'USD' AND actif = true
   LIMIT 1) AS cdf_to_usd
ON true;

-- Fonction pour initialiser les deux taux si un seul existe
CREATE OR REPLACE FUNCTION initialize_bidirectional_rates()
RETURNS void AS $$
DECLARE
  v_usd_to_cdf numeric;
  v_cdf_to_usd numeric;
  v_inverse_rate numeric;
BEGIN
  v_usd_to_cdf := get_active_exchange_rate('USD', 'CDF');
  v_cdf_to_usd := get_active_exchange_rate('CDF', 'USD');

  IF v_usd_to_cdf IS NOT NULL AND v_cdf_to_usd IS NULL THEN
    v_inverse_rate := 1.0 / v_usd_to_cdf;

    INSERT INTO exchange_rates (
      devise_source,
      devise_destination,
      taux,
      actif,
      notes
    ) VALUES (
      'CDF',
      'USD',
      v_inverse_rate,
      true,
      'Taux initialisé automatiquement (inverse de USD→CDF: ' || v_usd_to_cdf || ')'
    );
  END IF;

  IF v_cdf_to_usd IS NOT NULL AND v_usd_to_cdf IS NULL THEN
    v_inverse_rate := 1.0 / v_cdf_to_usd;

    INSERT INTO exchange_rates (
      devise_source,
      devise_destination,
      taux,
      actif,
      notes
    ) VALUES (
      'USD',
      'CDF',
      v_inverse_rate,
      true,
      'Taux initialisé automatiquement (inverse de CDF→USD: ' || v_cdf_to_usd || ')'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Exécuter l'initialisation pour créer le taux manquant si nécessaire
SELECT initialize_bidirectional_rates();
