# Correction du Système de Taux CDF→USD

## Date
22 janvier 2026

## Problème Identifié

Les fonctions de transaction mixte avec CDF comme devise de référence utilisaient le mauvais taux de change (USD→CDF au lieu de CDF→USD), causant des erreurs de validation.

### Exemple du Problème

**Configuration des taux :**
- Taux d'achat USD (USD→CDF) : 2200 (1 USD = 2200 CDF)
- Taux de vente USD (CDF→USD) : 0.0004 (1 CDF = 0.0004 USD, soit 1 USD = 2500 CDF)

**Transaction problématique :**
- Montant total : 250,000 CDF
- Paiement : 150,000 CDF + montant USD à calculer
- Reste à convertir : 100,000 CDF

**Calcul erroné (avant correction) :**
```
Montant USD = 100,000 CDF / 2200 = 45.45 USD ❌
```

**Calcul correct (après correction) :**
```
Montant USD = 100,000 CDF × 0.0004 = 40 USD ✅
```

### Impact

Les utilisateurs ne pouvaient pas créer de transactions mixtes avec CDF comme devise principale lorsqu'un taux de vente USD différent du taux d'achat était configuré.

## Solution Implémentée

### 1. Corrections dans les Fonctions SQL

**Fichiers modifiés :**
- `create_transaction_mixte_retrait_cdf`
- `create_transaction_mixte_depot_cdf`

**Changements principaux :**

#### Avant (❌ Incorrect)
```sql
-- Utilisait le taux USD→CDF
v_taux_change := get_active_exchange_rate('USD', 'CDF');

-- Calculait avec division
v_montant_usd_equivalent := (p_montant_total_cdf - p_montant_paye_cdf) / v_taux_change;
```

#### Après (✅ Correct)
```sql
-- Utilise le taux CDF→USD
v_taux_change := get_active_exchange_rate('CDF', 'USD');

-- Calcule le taux pour affichage
v_taux_affichage := ROUND(1.0 / v_taux_change, 2);

-- Calcule avec multiplication
v_montant_usd_equivalent := (p_montant_total_cdf - p_montant_paye_cdf) * v_taux_change;
```

### 2. Améliorations des Messages d'Erreur

Les messages d'erreur affichent maintenant le taux de manière compréhensible pour l'utilisateur :

```sql
RAISE EXCEPTION 'Montant USD incorrect. Attendu: % USD pour % CDF au taux 1 USD = % CDF (taux interne: 1 CDF = % USD)',
  ROUND(v_montant_usd_equivalent, 2),
  (p_montant_total_cdf - p_montant_recu_cdf),
  v_taux_affichage,  -- Ex: 2500
  v_taux_change;      -- Ex: 0.0004
```

### 3. Cohérence de l'Interface Utilisateur

Le formulaire frontend affiche également le taux de manière normalisée :

```typescript
{exchangeRate.devise_source === 'CDF' && exchangeRate.devise_destination === 'USD' ? (
  <>
    Taux actif: 1 USD = {(1 / exchangeRate.taux).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} CDF
    <span className="block text-xs text-emerald-600 mt-0.5">
      (taux interne: 1 CDF = {exchangeRate.taux.toFixed(6)} USD)
    </span>
  </>
) : (
  <>
    Taux actif: 1 {exchangeRate.devise_source} = {exchangeRate.taux.toLocaleString('fr-FR')} {exchangeRate.devise_destination}
  </>
)}
```

## Guide d'Utilisation

### Configuration des Taux Bidirectionnels

Pour configurer des taux d'achat et de vente différents :

#### 1. Taux d'Achat USD (USD→CDF)
```sql
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
VALUES ('USD', 'CDF', 2200, true, 'Taux achat USD - 1 USD = 2200 CDF');
```

#### 2. Taux de Vente USD (CDF→USD)
```sql
-- Pour un taux de vente de 1 USD = 2500 CDF
-- Le taux à saisir est : 1 / 2500 = 0.0004
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
VALUES ('CDF', 'USD', 0.0004, true, 'Taux vente USD - 1 USD = 2500 CDF');
```

### Exemples de Transactions

#### Exemple 1 : Retrait avec devise principale CDF

**Scénario :**
- Total à retirer : 250,000 CDF
- Taux de vente USD : 1 USD = 2500 CDF (0.0004)
- Paiement : 150,000 CDF + X USD

**Calcul automatique :**
```
Reste en CDF = 250,000 - 150,000 = 100,000 CDF
Montant USD = 100,000 × 0.0004 = 40 USD
```

**Transaction finale :**
- 150,000 CDF + 40 USD = 250,000 CDF au taux 2500

#### Exemple 2 : Dépôt avec devise principale CDF

**Scénario :**
- Total à déposer : 540,000 CDF
- Taux de vente USD : 1 USD = 2700 CDF (0.00037037)
- Réception : 340,000 CDF + X USD

**Calcul automatique :**
```
Reste en CDF = 540,000 - 340,000 = 200,000 CDF
Montant USD = 200,000 × 0.00037037 = 74.07 USD (arrondi)
```

**Transaction finale :**
- 340,000 CDF + 74.07 USD = 540,000 CDF au taux 2700

#### Exemple 3 : Retrait avec devise principale USD

**Scénario :**
- Total à retirer : 100 USD
- Taux d'achat USD : 1 USD = 2000 CDF
- Paiement : 50 USD + X CDF

**Calcul automatique :**
```
Reste en USD = 100 - 50 = 50 USD
Montant CDF = 50 × 2000 = 100,000 CDF
```

**Transaction finale :**
- 50 USD + 100,000 CDF = 100 USD au taux 2000

## Vérification du Système

### Requêtes de Diagnostic

#### 1. Vérifier les taux actifs
```sql
SELECT * FROM v_active_exchange_rates;
```

#### 2. Vérifier la configuration bidirectionnelle
```sql
SELECT * FROM check_bidirectional_rates_configured();
```

#### 3. Consulter le résumé des taux
```sql
SELECT * FROM v_exchange_rates_summary;
```

### Tests de Validation

#### Test 1 : Transaction CDF→USD
```sql
-- Créer une transaction de retrait CDF
SELECT create_transaction_mixte_retrait_cdf(
  p_service_id := 'votre-service-id',
  p_montant_total_cdf := 250000,
  p_montant_paye_cdf := 150000,
  p_montant_paye_usd := 40,
  p_info_client := 'Test CDF→USD',
  p_created_by := 'votre-user-id'
);
```

#### Test 2 : Transaction USD→CDF
```sql
-- Créer une transaction de retrait USD
SELECT create_transaction_mixte_retrait(
  p_service_id := 'votre-service-id',
  p_montant_total_usd := 100,
  p_montant_paye_usd := 50,
  p_montant_paye_cdf := 100000,
  p_info_client := 'Test USD→CDF',
  p_created_by := 'votre-user-id'
);
```

## Rétrocompatibilité

### Transactions Existantes
Toutes les transactions existantes restent inchangées. Seules les nouvelles transactions utilisent le système corrigé.

### Configuration des Taux
Si un seul taux est configuré, le système peut automatiquement créer le taux inverse :

```sql
SELECT initialize_bidirectional_rates();
```

Cette fonction :
- Détecte si un seul sens est configuré
- Calcule et crée le taux inverse
- Permet au système de fonctionner immédiatement

## Résumé des Fichiers Modifiés

### Backend (SQL)
- **Migration** : `20260122090000_fix_transaction_mixte_cdf_use_correct_rate.sql`
  - Correction de `create_transaction_mixte_retrait_cdf`
  - Correction de `create_transaction_mixte_depot_cdf`

### Frontend (TypeScript)
- **Composant** : `src/components/transactions/TransactionMixteForm.tsx`
  - Affichage normalisé du taux CDF→USD
  - Messages d'erreur améliorés

## Bénéfices

1. **Précision des Calculs** : Les conversions utilisent maintenant le bon taux selon le sens de conversion
2. **Marge Commerciale** : Possibilité d'avoir des taux d'achat et de vente différents
3. **Clarté** : L'interface affiche les taux de manière compréhensible (ex: 1 USD = 2500 CDF)
4. **Flexibilité** : Support complet des transactions bidirectionnelles USD/CDF
5. **Traçabilité** : Les messages d'erreur indiquent clairement le taux utilisé

## Support Technique

En cas de problème :
1. Vérifier que les deux taux sont configurés (USD→CDF et CDF→USD)
2. Consulter les logs de la base de données pour les erreurs
3. Utiliser les requêtes de diagnostic ci-dessus
4. Vérifier que les montants respectent la formule : `montant_total = montant_devise1 + (montant_devise2 × taux)`
