/*
  # Correction de la logique des soldes virtuels

  ## Description
  Corrige la fonction update_balances_on_validation pour inverser la logique des soldes virtuels
  afin de correspondre au comportement attendu :
  - DEPOT : cash augmente, virtuel service diminue
  - RETRAIT : cash diminue, virtuel service augmente
  
  ## Changements
  Pour le portefeuille virtuel :
  - Débit virtuel → virtuel AUGMENTE (inversé)
  - Crédit virtuel → virtuel DIMINUE (inversé)
  
  Pour le portefeuille cash (reste inchangé) :
  - Débit cash → cash AUGMENTE
  - Crédit cash → cash DIMINUE

  ## Notes importantes
  Cette correction aligne le nouveau système multi-lignes avec l'ancien comportement
  de la table transactions simple qui fonctionnait correctement.
*/

CREATE OR REPLACE FUNCTION update_balances_on_validation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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
            UPDATE global_balances
            SET cash_usd = cash_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
            UPDATE global_balances
            SET cash_usd = cash_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE global_balances
            SET cash_cdf = cash_cdf + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
            UPDATE global_balances
            SET cash_cdf = cash_cdf - v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          END IF;
        END IF;
        
      ELSIF v_line.type_portefeuille = 'virtuel' AND v_line.service_id IS NOT NULL THEN
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf + v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf - v_line.montant,
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

COMMENT ON FUNCTION update_balances_on_validation IS 
  'Met à jour les soldes cash et virtuels avec la logique inversée pour le virtuel : débit=+, crédit=-';
