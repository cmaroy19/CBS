/*
  # Contrainte unique pour les taux actifs par paire
  
  1. Modifications
    - Ajoute une contrainte unique partielle pour s'assurer qu'il n'y a qu'un seul taux actif par paire de devises (devise_source, devise_destination)
    - Cette contrainte permet d'avoir plusieurs taux inactifs, mais un seul actif par paire
  
  2. Sécurité
    - Empêche les conflits de taux
    - Garantit la cohérence des conversions
*/

-- Créer une contrainte unique partielle pour éviter d'avoir plusieurs taux actifs pour la même paire
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_rate_per_pair 
ON exchange_rates (devise_source, devise_destination) 
WHERE actif = true;
