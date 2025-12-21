/*
  # Recréer le trigger de génération de référence pour la table transactions
  
  1. Problème
    - Le trigger sur la table `transactions` a été supprimé dans une migration précédente
    - Les dépôts/approvisionnements utilisent encore la table `transactions` (ancienne table)
    - Résultat: NULL value in column "reference" violates not-null constraint
  
  2. Solution
    - Recréer le trigger sur la table `transactions` qui appelle `set_transaction_reference()`
    - Cette fonction existe déjà et génère automatiquement une référence
  
  3. Notes
    - La fonction `set_transaction_reference()` existe déjà depuis la migration 20251221121046
    - Elle appelle `generate_transaction_reference()` qui compte depuis `transaction_headers`
    - Pour l'ancienne table `transactions`, nous devons adapter le compteur
*/

-- Vérifier que la fonction set_transaction_reference() existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_transaction_reference'
  ) THEN
    RAISE EXCEPTION 'La fonction set_transaction_reference() n''existe pas. Vérifier la migration 20251221121046.';
  END IF;
END $$;

-- Créer une fonction spécifique pour la table transactions (ancienne)
CREATE OR REPLACE FUNCTION set_transaction_reference_old()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_part text;
  v_count int;
  v_reference text;
  v_today date;
BEGIN
  -- Générer une référence si elle est vide ou NULL
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    -- Obtenir la date actuelle
    v_today := CURRENT_DATE;
    
    -- Formater la date en DD-MM-YYYY
    v_date_part := to_char(v_today, 'DD-MM-YYYY');
    
    -- Compter les transactions existantes pour aujourd'hui dans l'ANCIENNE table
    SELECT COUNT(*) + 1 INTO v_count
    FROM transactions
    WHERE DATE(created_at) = v_today;
    
    -- Format: DD-MM-YYYY-#### (ex: 21-12-2025-0001)
    v_reference := v_date_part || '-OLD-' || lpad(v_count::text, 4, '0');
    
    NEW.reference := v_reference;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger sur la table transactions
DROP TRIGGER IF EXISTS trigger_set_transaction_reference ON transactions;

CREATE TRIGGER trigger_set_transaction_reference
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_reference_old();

-- Commentaire
COMMENT ON FUNCTION set_transaction_reference_old() IS 
  'Fonction trigger qui génère automatiquement une référence pour les transactions de l''ancienne table (avec marqueur OLD).';
