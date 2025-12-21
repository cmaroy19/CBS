/*
  # Activer RLS sur toutes les tables

  1. Changements
    - Active Row Level Security sur users et approvisionnements
    - CRITIQUE: Sans RLS, les données sont accessibles à tous
    
  2. Sécurité
    - users: Les utilisateurs peuvent voir tous les users (pour les listes)
           - Seuls admin peuvent INSERT/UPDATE/DELETE
    - approvisionnements: Tous peuvent voir
                        - Seuls gerant/proprietaire peuvent INSERT/UPDATE/DELETE
*/

-- Activer RLS sur users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Activer RLS sur approvisionnements
ALTER TABLE approvisionnements ENABLE ROW LEVEL SECURITY;
