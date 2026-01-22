/*
  # Correction de la Validation d'Équilibre des Transactions Multi-Devises

  ## Description
  Cette migration corrige la fonction `validate_transaction_balance` pour valider
  l'équilibre comptable séparément pour chaque devise dans les transactions mixtes USD/CDF.

  ## Problème identifié
  La fonction `validate_transaction_balance` comparait la somme totale des débits
  avec la somme totale des crédits sans tenir compte des devises, ce qui causait
  des erreurs de validation dans les transactions mixtes.

  ### Exemple du problème
  Transaction avec 250,000 CDF et 100 USD:
  - Ancien calcul : total_débit = 250,000 + 100 = 250,100 ❌
  - Ancien calcul : total_crédit = 250,000 + 100 = 250,100 ❌
  (Additionne des devises différentes, non sens mathématique)

  ## Solution
  Valider l'équilibre séparément pour chaque devise :
  - Pour USD : somme(débits USD) = somme(crédits USD)
  - Pour CDF : somme(débits CDF) = somme(crédits CDF)

  ## Impact
  - Les transactions mixtes USD/CDF seront correctement validées
  - Les transactions mono-devise continuent de fonctionner normalement
  - Meilleure traçabilité des erreurs par devise
*/

-- Fonction corrigée pour valider l'équilibre par devise
CREATE OR REPLACE FUNCTION validate_transaction_balance(p_header_id uuid)
RETURNS boolean AS $$
DECLARE
  v_devise text;
  v_debit_usd numeric := 0;
  v_credit_usd numeric := 0;
  v_debit_cdf numeric := 0;
  v_credit_cdf numeric := 0;
BEGIN
  -- Calculer les débits et crédits pour USD
  SELECT 
    COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
  INTO v_debit_usd, v_credit_usd
  FROM transaction_lines
  WHERE header_id = p_header_id AND devise = 'USD';
  
  -- Calculer les débits et crédits pour CDF
  SELECT 
    COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
  INTO v_debit_cdf, v_credit_cdf
  FROM transaction_lines
  WHERE header_id = p_header_id AND devise = 'CDF';
  
  -- Vérifier l'équilibre pour chaque devise
  -- Utiliser une tolérance de 0.01 pour gérer les arrondis
  IF ABS(v_debit_usd - v_credit_usd) > 0.01 THEN
    RAISE EXCEPTION 'Transaction non équilibrée pour USD: débits=% USD, crédits=% USD', v_debit_usd, v_credit_usd;
  END IF;
  
  IF ABS(v_debit_cdf - v_credit_cdf) > 0.01 THEN
    RAISE EXCEPTION 'Transaction non équilibrée pour CDF: débits=% CDF, crédits=% CDF', v_debit_cdf, v_credit_cdf;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_transaction_balance IS 'Valide l''équilibre d''une transaction en vérifiant que débits=crédits pour chaque devise séparément (USD et CDF)';
