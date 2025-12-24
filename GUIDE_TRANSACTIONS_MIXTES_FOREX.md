# Guide d'utilisation - Transactions Mixtes avec Forex

## Vue d'ensemble

Le système de transactions mixtes permet d'effectuer des dépôts et retraits en USD avec un paiement combiné USD/CDF, en utilisant un taux de change configuré.

## Fonctionnalités

### 1. Module Taux de Change

Le nouveau menu "Taux de change" permet de :
- Configurer les taux USD/CDF
- Activer/désactiver des taux
- Définir des périodes de validité
- Historique des taux utilisés

#### Configuration d'un taux

1. Naviguer vers "Taux de change" dans le menu
2. Cliquer sur "Nouveau taux"
3. Remplir les informations :
   - **Devise source** : USD
   - **Devise destination** : CDF
   - **Taux** : Par exemple 2700 (1 USD = 2700 CDF)
   - **Actif** : Cocher pour activer ce taux
   - **Date de début** : Date d'application
   - **Date de fin** : Optionnel, pour limiter la durée
   - **Notes** : Commentaires optionnels

**Important** : Un seul taux peut être actif par paire de devises à la fois.

### 2. Transactions Mixtes

#### Accès

Dans la page "Transactions", cliquer sur "Nouvelle transaction" puis sélectionner l'onglet "Paiement mixte (Forex)".

#### Exemple concret : Retrait de 58 USD

**Scénario** : Un client veut retirer 58 USD, mais vous n'avez que 50 USD en caisse.

**Solution** : Paiement mixte
- Montant total : 58 USD
- Payé en USD : 50 USD
- Payé en CDF : 17,600 CDF (équivalent à 8 USD au taux de 2200)

**Processus** :

1. Sélectionner le service concerné
2. Entrer le montant total : 58 USD
3. Entrer le montant USD : 50 USD
4. Le système calcule automatiquement : 17,600 CDF pour les 8 USD restants
5. Valider la transaction

#### Ce qui se passe en arrière-plan

Le système crée une transaction multi-lignes équilibrée :

**Pour un retrait de 58 USD (50 USD + 17,600 CDF)** :

| Compte | Débit | Crédit | Devise |
|--------|-------|--------|--------|
| Service virtuel USD | 58 USD | - | USD |
| Cash USD | - | 50 USD | USD |
| Cash CDF | - | 17,600 CDF | CDF |

**Vérifications automatiques** :
- Le solde virtuel du service est suffisant (≥ 58 USD)
- Le cash USD disponible est suffisant (≥ 50 USD)
- Le cash CDF disponible est suffisant (≥ 17,600 CDF)
- Le montant CDF correspond exactement au taux configuré
- Les débits = les crédits (équilibre comptable)

### 3. Transactions de Dépôt Mixtes

Même principe inversé : un client dépose 58 USD en donnant 50 USD + 17,600 CDF.

**Écritures** :

| Compte | Débit | Crédit | Devise |
|--------|-------|--------|--------|
| Cash USD | 50 USD | - | USD |
| Cash CDF | 17,600 CDF | - | CDF |
| Service virtuel USD | - | 58 USD | USD |

### 4. Avantages du système

1. **Traçabilité complète** : Chaque transaction est enregistrée avec :
   - Le taux utilisé (figé au moment de la transaction)
   - La répartition exacte USD/CDF
   - La référence unique
   - L'utilisateur qui a créé la transaction

2. **Sécurité** :
   - Validation des soldes avant transaction
   - Vérification automatique des montants
   - Impossibilité de modifier une transaction validée

3. **Flexibilité** :
   - Choix libre de la répartition USD/CDF
   - Calcul automatique ou manuel
   - Compatible avec les anciennes transactions simples

4. **Comptabilité** :
   - Respect de la partie double
   - Équilibre automatique des écritures
   - Historique complet des mouvements

### 5. Bonnes pratiques

1. **Configuration du taux** :
   - Mettre à jour le taux régulièrement selon le marché
   - Désactiver les anciens taux plutôt que de les supprimer
   - Utiliser les notes pour documenter les changements

2. **Utilisation** :
   - Vérifier le taux actif avant chaque transaction
   - Toujours renseigner l'info client pour la traçabilité
   - Utiliser le calcul automatique pour éviter les erreurs

3. **Gestion** :
   - Consulter régulièrement les transactions mixtes
   - Vérifier la cohérence des soldes USD et CDF
   - Former les utilisateurs sur le processus

### 6. Cas d'usage typiques

#### Cas 1 : Retrait tout en CDF
- Client veut 50 USD
- Vous n'avez pas de USD en caisse
- Solution : 0 USD + 135,000 CDF (au taux 2700)

#### Cas 2 : Retrait majoritairement en USD
- Client veut 100 USD
- Vous donnez 95 USD + 13,500 CDF
- Optimise votre trésorerie USD

#### Cas 3 : Dépôt en CDF
- Client dépose l'équivalent de 200 USD
- Il donne 540,000 CDF
- Son compte virtuel est crédité de 200 USD

### 7. Système de correction

#### Pourquoi corriger une transaction ?

Des erreurs peuvent survenir :
- Montant saisi incorrectement
- Mauvais service sélectionné
- Erreur de calcul dans la répartition USD/CDF
- Transaction saisie en doublon

#### Comment corriger

**Accès** : Seuls les `administrateur` et `proprietaire` peuvent corriger des transactions.

**Processus** :
1. Dans la liste des transactions, cliquer sur "Corriger" pour la transaction concernée
2. Saisir obligatoirement la raison de la correction
3. Confirmer la correction

**Ce qui se passe** :
- Une transaction inverse est créée automatiquement
- Tous les mouvements sont inversés (débit ↔ crédit)
- Les soldes reviennent à leur état d'origine
- La transaction originale est marquée comme "Annulée"
- L'historique complet est conservé pour l'audit

#### Exemple de correction

**Transaction originale** :
- Retrait de 58 USD (50 USD + 17,600 CDF)
- Service : Illico Cash
- Résultat : Solde virtuel Illico -58 USD, Cash USD +50 USD, Cash CDF +17,600 CDF

**Transaction de correction** :
- Dépôt de 58 USD (50 USD + 17,600 CDF)
- Service : Illico Cash
- Résultat : Annule complètement la transaction originale

#### Traçabilité

Chaque correction enregistre :
- La raison de la correction
- L'utilisateur qui a fait la correction
- La date et l'heure
- Le lien vers la transaction originale

Ces informations sont accessibles dans l'historique des transactions et les logs d'audit.

### 8. Limitations et contrôles

- Un taux de change doit être actif pour créer une transaction mixte
- Les montants doivent correspondre exactement (tolérance de 0.01)
- Les soldes sont vérifiés en temps réel
- Une transaction validée ne peut être annulée (seulement corrigée)
- Une transaction ne peut être corrigée qu'une seule fois
- Les corrections nécessitent une raison obligatoire

## Support

Pour toute question ou problème :
1. Vérifier que le taux de change est correctement configuré
2. Consulter les logs d'audit en cas d'erreur
3. En cas d'erreur de saisie, utiliser le système de correction (administrateur uniquement)
4. Consulter le document "SYSTEME_CORRECTION_TRANSACTIONS.md" pour plus de détails techniques
5. Contacter l'administrateur système si nécessaire

## Documents connexes

- **SYSTEME_CORRECTION_TRANSACTIONS.md** : Documentation technique complète du système de correction
- **TRANSACTION_CORRECTIONS.md** : Guide des corrections de transactions
- **TRANSACTIONS_REFACTORING.md** : Architecture technique du système de transactions
