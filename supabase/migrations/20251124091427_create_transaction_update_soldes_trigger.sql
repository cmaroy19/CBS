/*
  # Trigger Automatique - Mise à Jour Soldes après Transaction

  1. Fonction Trigger
    - `update_soldes_on_transaction()` 
    - S'exécute automatiquement après INSERT dans `transactions`
    - Met à jour le `service.solde_virtuel_*` 
    - Met à jour le `global_balances.cash_*`
    - Gère DEPOT et RETRAIT correctement

  2. Logique
    - **DEPOT**: client dépose de l'argent
      - Cash augmente (+)
      - Virtuel service diminue (-)
    
    - **RETRAIT**: client retire de l'argent  
      - Cash diminue (-)
      - Virtuel service augmente (+)

  3. Sécurité
    - Trigger s'exécute avec privilèges SECURITY DEFINER
    - Bypass RLS automatiquement
    - Garantit cohérence des données

  4. Notes
    - Remplace la logique frontend (plus fiable)
    - Transaction atomique garantie
    - Pas besoin de permissions UPDATE pour users
*/

-- Fonction qui met à jour les soldes automatiquement
CREATE OR REPLACE FUNCTION update_soldes_on_transaction()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_solde_key text;
  v_cash_key text;
  v_current_service_solde numeric;
  v_current_cash numeric;
  v_new_service_solde numeric;
  v_new_cash numeric;
BEGIN
  -- Déterminer les clés de colonnes selon la devise
  IF NEW.devise = 'USD' THEN
    v_solde_key := 'solde_virtuel_usd';
    v_cash_key := 'cash_usd';
  ELSE
    v_solde_key := 'solde_virtuel_cdf';
    v_cash_key := 'cash_cdf';
  END IF;

  -- Récupérer le solde actuel du service
  EXECUTE format('SELECT %I FROM services WHERE id = $1', v_solde_key)
    INTO v_current_service_solde
    USING NEW.service_id;

  -- Récupérer le cash global actuel
  EXECUTE format('SELECT %I FROM global_balances LIMIT 1', v_cash_key)
    INTO v_current_cash;

  -- Calculer les nouveaux soldes selon le type de transaction
  IF NEW.type = 'depot' THEN
    -- DEPOT: client dépose → cash augmente, virtuel service diminue
    v_new_cash := v_current_cash + NEW.montant;
    v_new_service_solde := v_current_service_solde - NEW.montant;
  ELSE
    -- RETRAIT: client retire → cash diminue, virtuel service augmente  
    v_new_cash := v_current_cash - NEW.montant;
    v_new_service_solde := v_current_service_solde + NEW.montant;
  END IF;

  -- Mettre à jour le solde du service
  EXECUTE format('UPDATE services SET %I = $1 WHERE id = $2', v_solde_key)
    USING v_new_service_solde, NEW.service_id;

  -- Mettre à jour le cash global
  EXECUTE format('UPDATE global_balances SET %I = $1', v_cash_key)
    USING v_new_cash;

  RETURN NEW;
END;
$$;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_update_soldes_on_transaction ON transactions;

-- Créer le trigger sur INSERT dans transactions
CREATE TRIGGER trigger_update_soldes_on_transaction
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_soldes_on_transaction();

-- Commentaire pour documentation
COMMENT ON FUNCTION update_soldes_on_transaction() IS 
  'Met à jour automatiquement les soldes du service et du cash global après création d''une transaction';
