/*
  # Activer RLS sur la table services

  1. Changements
    - Active Row Level Security sur la table services
    - Les politiques existantes seront maintenant appliquées
    
  2. Sécurité
    - CRITIQUE: Sans RLS activé, toutes les politiques sont ignorées
    - Après activation, seuls proprietaire et gerant peuvent INSERT/UPDATE/DELETE
    - Tous les utilisateurs authentifiés peuvent SELECT
*/

-- Activer RLS sur services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
