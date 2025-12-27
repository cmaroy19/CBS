# Support des Transactions Mixtes en CDF

## Vue d'ensemble

Le système de transactions mixtes supporte maintenant deux devises de référence :
- **USD** : Montant total en USD, payé/reçu en combinaison USD + CDF
- **CDF** : Montant total en CDF, payé/reçu en combinaison CDF + USD

## Modifications apportées

### 1. Nouvelles Fonctions SQL

Deux nouvelles fonctions ont été créées pour gérer les transactions avec montant total en CDF :

#### `create_transaction_mixte_retrait_cdf`
Permet un retrait avec montant total en CDF, payé en combinaison CDF + USD.

**Exemple :**
```sql
SELECT create_transaction_mixte_retrait_cdf(
  p_service_id := 'uuid-du-service',
  p_montant_total_cdf := 128000,    -- Total : 128 000 CDF
  p_montant_paye_cdf := 100000,     -- Payé en CDF : 100 000 CDF
  p_montant_paye_usd := 12.73,      -- Payé en USD : 12.73 USD (équivalent à 28 000 CDF au taux 2200)
  p_info_client := 'Client XYZ',
  p_created_by := 'uuid-utilisateur'
);
```

#### `create_transaction_mixte_depot_cdf`
Permet un dépôt avec montant total en CDF, reçu en combinaison CDF + USD.

**Exemple :**
```sql
SELECT create_transaction_mixte_depot_cdf(
  p_service_id := 'uuid-du-service',
  p_montant_total_cdf := 220000,    -- Total : 220 000 CDF
  p_montant_recu_cdf := 200000,     -- Reçu en CDF : 200 000 CDF
  p_montant_recu_usd := 9.09,       -- Reçu en USD : 9.09 USD (équivalent à 20 000 CDF au taux 2200)
  p_info_client := 'Client ABC',
  p_created_by := 'uuid-utilisateur'
);
```

### 2. Formulaire Frontend

Le formulaire `TransactionMixteForm` a été mis à jour pour :

1. **Sélectionner la devise de référence** : Un nouveau champ permet de choisir entre USD et CDF
2. **Adapter l'interface** : Les champs s'adaptent automatiquement selon la devise choisie
3. **Calcul automatique** : Le calcul des montants respecte la devise de référence

#### Fonctionnalités du formulaire

**Pour USD comme devise de référence :**
- L'utilisateur saisit le montant total en USD
- Il saisit le montant payé/reçu en USD
- Le système calcule automatiquement l'équivalent CDF du reste

**Pour CDF comme devise de référence :**
- L'utilisateur saisit le montant total en CDF
- Il saisit le montant payé/reçu en CDF
- Le système calcule automatiquement l'équivalent USD du reste

### 3. Validation des montants

Le système vérifie automatiquement que :
- Le montant total est correct
- Les conversions respectent le taux de change actif
- Les soldes sont suffisants (virtuel pour le service, cash pour la caisse)

## Exemples d'utilisation

### Retrait en USD avec paiement mixte
**Scénario :** Retrait de 58 USD payé avec 50 USD + 17 600 CDF (taux 2200)
- Devise de référence : USD
- Montant total : 58 USD
- Montant USD : 50 USD
- Montant CDF : 17 600 CDF (équivalent à 8 USD)

### Retrait en CDF avec paiement mixte
**Scénario :** Retrait de 128 000 CDF payé avec 100 000 CDF + 12.73 USD (taux 2200)
- Devise de référence : CDF
- Montant total : 128 000 CDF
- Montant CDF : 100 000 CDF
- Montant USD : 12.73 USD (équivalent à 28 000 CDF)

### Dépôt en USD avec réception mixte
**Scénario :** Dépôt de 100 USD reçu en 80 USD + 44 000 CDF (taux 2200)
- Devise de référence : USD
- Montant total : 100 USD
- Montant USD : 80 USD
- Montant CDF : 44 000 CDF (équivalent à 20 USD)

### Dépôt en CDF avec réception mixte
**Scénario :** Dépôt de 220 000 CDF reçu en 200 000 CDF + 9.09 USD (taux 2200)
- Devise de référence : CDF
- Montant total : 220 000 CDF
- Montant CDF : 200 000 CDF
- Montant USD : 9.09 USD (équivalent à 20 000 CDF)

## Impact sur les soldes

### Retrait avec devise de référence USD
- **Service virtuel USD** : Débit du montant total en USD
- **Cash USD** : Crédit du montant payé en USD
- **Cash CDF** : Crédit du montant payé en CDF

### Retrait avec devise de référence CDF
- **Service virtuel CDF** : Débit du montant total en CDF
- **Cash CDF** : Crédit du montant payé en CDF
- **Cash USD** : Crédit du montant payé en USD

### Dépôt avec devise de référence USD
- **Service virtuel USD** : Crédit du montant total en USD
- **Cash USD** : Débit du montant reçu en USD
- **Cash CDF** : Débit du montant reçu en CDF

### Dépôt avec devise de référence CDF
- **Service virtuel CDF** : Crédit du montant total en CDF
- **Cash CDF** : Débit du montant reçu en CDF
- **Cash USD** : Débit du montant reçu en USD

## Notes techniques

1. **Taux de change** :
   - Le système charge **le bon taux** selon la devise de référence sélectionnée :
     - **Mode USD** : Charge le taux `USD/CDF` depuis la base de données
     - **Mode CDF** : Charge le taux `CDF/USD` depuis la base de données
   - Chaque taux est indépendant et configuré séparément dans le module Taux de change
   - **Affichage adaptatif** :
     - En mode USD : affiche "1 USD = X CDF" (où X est le taux USD/CDF configuré)
     - En mode CDF : affiche "1 CDF = Y USD" (où Y est le taux CDF/USD configuré)
   - **Important** : Le système ne calcule PAS l'inverse d'un taux, il charge le taux correspondant directement

2. **Précision** : Les calculs acceptent une tolérance de 0.01 pour les arrondis

3. **Équilibrage** : Les lignes de transaction respectent toujours le principe débits = crédits

4. **Traçabilité** : Chaque transaction est enregistrée dans les audit_logs avec toutes les informations pertinentes

## Configuration des taux de change

Pour utiliser les transactions mixtes dans les deux sens, vous devez configurer **deux taux séparés** dans le module Taux de change :

### Exemple de configuration :

1. **Taux USD/CDF = 2 300**
   - Source : USD
   - Destination : CDF
   - Taux : 2 300
   - Utilisé pour les transactions en USD
   - Signification : 1 USD = 2 300 CDF

2. **Taux CDF/USD = 2 500**
   - Source : CDF
   - Destination : USD
   - Taux : 2 500
   - Utilisé pour les transactions en CDF
   - Signification : 1 CDF = 2 500 USD (ou 0.0004 USD si on exprime en décimales)

**Remarque importante** : Les deux taux sont indépendants et peuvent être différents selon la politique de change de votre entreprise. Le système ne calcule jamais automatiquement l'inverse d'un taux, il utilise toujours le taux explicitement configuré dans la direction correspondante.
