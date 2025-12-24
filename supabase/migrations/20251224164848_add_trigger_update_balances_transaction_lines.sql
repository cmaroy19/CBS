/*
  # Trigger pour Mise à Jour des Soldes - Transactions Multi-Lignes

  1. Fonction Trigger
    - `update_balances_from_transaction_lines()` 
    - S'exécute automatiquement après INSERT dans `transaction_lines`
    - Met à jour les soldes uniquement si la transaction est validée
    - Gère les débits et crédits correctement

  2. Logique
    - **DEBIT**: Sortie d'argent
      - Cash/Virtuel diminue (-)
    
    - **CREDIT**: Entrée d'argent  
      - Cash/Virtuel augmente (+)

  3. Type de portefeuille
    - **cash**: Met à jour global_balances
    - **virtuel**: Met à jour services.solde_virtuel_*

  4. Notes
    - Ne s'applique que pour les transactions validées
    - Transaction atomique garantie
    - Compatible avec le système de correction
*/

-- Fonction qui met à jour les soldes depuis les lignes de transaction
CREATE OR REPLACE FUNCTION update_balances_from_transaction_lines()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_header_statut text;
  v_solde_key text;
  v_cash_key text;
  v_current_balance numeric;
  v_new_balance numeric;
  v_delta numeric;
BEGIN
  -- Vérifier si la transaction est validée
  SELECT statut INTO v_header_statut
  FROM transaction_headers
  WHERE id = NEW.header_id;

  -- Ne rien faire si la transaction n'est pas validée
  IF v_header_statut != 'validee' THEN
    RETURN NEW;
  END IF;

  -- Déterminer les clés de colonnes selon la devise
  IF NEW.devise = 'USD' THEN
    v_solde_key := 'solde_virtuel_usd';
    v_cash_key := 'cash_usd';
  ELSE
    v_solde_key := 'solde_virtuel_cdf';
    v_cash_key := 'cash_cdf';
  END IF;

  -- Calculer le delta selon le sens (debit = sortie, credit = entrée)
  IF NEW.sens = 'debit' THEN
    v_delta := -NEW.montant;  -- Sortie
  ELSE
    v_delta := NEW.montant;   -- Entrée
  END IF;

  -- Mettre à jour selon le type de portefeuille
  IF NEW.type_portefeuille = 'cash' THEN
    -- Mettre à jour le cash global
    EXECUTE format('SELECT %I FROM global_balances LIMIT 1', v_cash_key)
      INTO v_current_balance;
    
    v_new_balance := v_current_balance + v_delta;
    
    EXECUTE format('UPDATE global_balances SET %I = $1', v_cash_key)
      USING v_new_balance;
  ELSIF NEW.type_portefeuille = 'virtuel' AND NEW.service_id IS NOT NULL THEN
    -- Mettre à jour le solde virtuel du service
    EXECUTE format('SELECT %I FROM services WHERE id = $1', v_solde_key)
      INTO v_current_balance
      USING NEW.service_id;
    
    v_new_balance := v_current_balance + v_delta;
    
    EXECUTE format('UPDATE services SET %I = $1 WHERE id = $2', v_solde_key)
      USING v_new_balance, NEW.service_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_update_balances_from_lines ON transaction_lines;

-- Créer le trigger sur INSERT dans transaction_lines
CREATE TRIGGER trigger_update_balances_from_lines
  AFTER INSERT ON transaction_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_balances_from_transaction_lines();

-- Commentaire pour documentation
COMMENT ON FUNCTION update_balances_from_transaction_lines() IS 
  'Met à jour automatiquement les soldes (cash global ou service) après insertion d''une ligne de transaction validée';
