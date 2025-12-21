/*
  # Correction de l'erreur "trigger functions can only be called as triggers" - Partie 1
  
  ## Problème Identifié
  La fonction `generate_transaction_reference()` était définie comme une fonction TRIGGER
  mais était appelée directement dans `set_transaction_reference()`, ce qui est interdit.
  
  Il existe aussi un ancien trigger sur la table `transactions` qui doit être nettoyé.
  
  ## Solution - Partie 1: Nettoyage
  Supprimer l'ancien trigger sur la table `transactions` avant de recréer la fonction.
*/

-- Supprimer l'ancien trigger sur la table transactions (si elle existe encore)
DROP TRIGGER IF EXISTS trigger_generate_transaction_reference ON transactions;

-- Supprimer aussi la fonction avec CASCADE pour s'assurer qu'il n'y a plus de dépendances
DROP FUNCTION IF EXISTS generate_transaction_reference() CASCADE;
