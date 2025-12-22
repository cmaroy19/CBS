/*
  # Correction de la validation d'équilibre pour transactions Forex

  ## Description
  Corrige la fonction validate_transaction_balance pour supporter les transactions
  multi-devises (USD/CDF). La fonction convertit maintenant tous les montants dans
  la devise de référence avant de valider l'équilibre.

  ## Modifications
  - Mise à jour de validate_transaction_balance pour :
    1. Récupérer le taux de change et la devise de référence du header
    2. Convertir les montants CDF en USD (ou vice versa) selon la devise de référence
    3. Valider l'équilibre dans la devise de référence unique

  ## Logique
  Pour une transaction avec devise_reference = 'USD' et taux_change = 2200 :
  - Débit : 58 USD (service virtuel)
  - Crédit : 50 USD (cash) + 17600 CDF (cash)
  
  Conversion en USD :
  - Débit total : 58 USD
  - Crédit total : 50 USD + (17600 / 2200) = 50 + 8 = 58 USD
  - Équilibre : 58 = 58 ✓
*/

-- Fonction corrigée de validation d'équilibrage multi-devises
CREATE OR REPLACE FUNCTION validate_transaction_balance(p_header_id uuid)
RETURNS boolean AS $$
DECLARE
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_taux_change numeric;
  v_devise_reference text;
  v_line record;
BEGIN
  -- Récupérer le taux de change et la devise de référence
  SELECT taux_change, devise_reference
  INTO v_taux_change, v_devise_reference
  FROM transaction_headers
  WHERE id = p_header_id;

  -- Si pas de taux de change, validation simple (transaction mono-devise)
  IF v_taux_change IS NULL THEN
    SELECT 
      COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
    INTO v_total_debit, v_total_credit
    FROM transaction_lines
    WHERE header_id = p_header_id;
    
    RETURN v_total_debit = v_total_credit;
  END IF;

  -- Transaction multi-devises : convertir tout dans la devise de référence
  FOR v_line IN
    SELECT devise, sens, montant
    FROM transaction_lines
    WHERE header_id = p_header_id
  LOOP
    DECLARE
      v_montant_converti numeric;
    BEGIN
      -- Convertir le montant dans la devise de référence
      IF v_line.devise = v_devise_reference THEN
        -- Même devise, pas de conversion
        v_montant_converti := v_line.montant;
      ELSIF v_devise_reference = 'USD' AND v_line.devise = 'CDF' THEN
        -- CDF vers USD : diviser par le taux
        v_montant_converti := v_line.montant / v_taux_change;
      ELSIF v_devise_reference = 'CDF' AND v_line.devise = 'USD' THEN
        -- USD vers CDF : multiplier par le taux
        v_montant_converti := v_line.montant * v_taux_change;
      ELSE
        -- Devise non supportée
        RAISE EXCEPTION 'Devise non supportée: %', v_line.devise;
      END IF;

      -- Ajouter au total approprié
      IF v_line.sens = 'debit' THEN
        v_total_debit := v_total_debit + v_montant_converti;
      ELSE
        v_total_credit := v_total_credit + v_montant_converti;
      END IF;
    END;
  END LOOP;

  -- Vérifier l'équilibre avec une tolérance de 0.01 pour les arrondis
  RETURN ABS(v_total_debit - v_total_credit) < 0.01;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_transaction_balance IS 'Valide l''équilibre d''une transaction en supportant les multi-devises avec conversion selon le taux de change';
