# Correction de l'Équilibre des Transactions Mixtes CDF/USD

## Date
22 janvier 2026

## Problème Identifié

Les transactions mixtes avec CDF comme devise principale échouaient avec l'erreur :
```
Transaction non équilibrée: les débits ne sont pas égaux aux crédits
```

### Cause Racine

Deux problèmes distincts causaient cette erreur :

#### 1. Validation d'équilibre incorrecte

La fonction `validate_transaction_balance` additionnait les montants de toutes les devises ensemble, sans distinction :

```sql
-- ❌ Ancien code (incorrect)
SELECT
  COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
INTO v_total_debit, v_total_credit
FROM transaction_lines
WHERE header_id = p_header_id;
```

**Exemple du problème :**
- Transaction : 250,000 CDF + 100 USD
- Calcul erroné : `total_débit = 250,000 + 100 = 250,100`
- Calcul erroné : `total_crédit = 250,000 + 100 = 250,100`
- Résultat : Validation passe même si les montants ne sont pas équilibrés par devise

#### 2. Écritures comptables manquantes

Les fonctions `create_transaction_mixte_retrait_cdf` et `create_transaction_mixte_depot_cdf` ne créaient pas de lignes de conversion entre les devises.

**Exemple du problème :**
Transaction : Retrait de 250,000 CDF payé en 150,000 CDF + 100 USD

**Écritures créées (incorrectes) :**
```
Ligne 1 : Débit service virtuel CDF : 250,000
Ligne 2 : Crédit cash CDF : 150,000
Ligne 3 : Crédit cash USD : 100
```

**Équilibre par devise :**
- CDF : Débit 250,000 ≠ Crédit 150,000 ❌
- USD : Débit 0 ≠ Crédit 100 ❌

## Solutions Implémentées

### 1. Validation par Devise Séparée

La fonction `validate_transaction_balance` vérifie maintenant l'équilibre pour chaque devise indépendamment :

```sql
-- ✅ Nouveau code (correct)
-- Calculer pour USD
SELECT
  COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
INTO v_debit_usd, v_credit_usd
FROM transaction_lines
WHERE header_id = p_header_id AND devise = 'USD';

-- Calculer pour CDF
SELECT
  COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
INTO v_debit_cdf, v_credit_cdf
FROM transaction_lines
WHERE header_id = p_header_id AND devise = 'CDF';

-- Vérifier l'équilibre avec tolérance de 0.01
IF ABS(v_debit_usd - v_credit_usd) > 0.01 THEN
  RAISE EXCEPTION 'Transaction non équilibrée pour USD: débits=% USD, crédits=% USD',
    v_debit_usd, v_credit_usd;
END IF;

IF ABS(v_debit_cdf - v_credit_cdf) > 0.01 THEN
  RAISE EXCEPTION 'Transaction non équilibrée pour CDF: débits=% CDF, crédits=% CDF',
    v_debit_cdf, v_credit_cdf;
END IF;
```

**Avantages :**
- Validation mathématiquement correcte
- Messages d'erreur spécifiques par devise
- Tolérance de 0.01 pour gérer les arrondis

### 2. Ajout des Lignes de Conversion

Les fonctions créent maintenant des lignes de conversion pour équilibrer chaque devise.

**Écritures correctes :**
Transaction : Retrait de 250,000 CDF payé en 150,000 CDF + 100 USD (taux 2500)

```
Ligne 1 : Débit service virtuel CDF : 250,000 CDF
Ligne 2 : Crédit cash CDF : 150,000 CDF
Ligne 3 : Crédit service virtuel CDF : 100,000 CDF (conversion)
Ligne 4 : Débit service virtuel USD : 100 USD (conversion)
Ligne 5 : Crédit cash USD : 100 USD
```

**Équilibre par devise :**
- **CDF** : Débit 250,000 = Crédit (150,000 + 100,000) ✅
- **USD** : Débit 100 = Crédit 100 ✅

**Signification des lignes de conversion :**
- **Ligne 3** : Le service récupère 100,000 CDF "virtuels" qui représentent la valeur CDF de 100 USD
- **Ligne 4** : Ces 100,000 CDF sont convertis en 100 USD qui sortent du service
- **Ligne 5** : Les 100 USD sont ajoutés au cash

## Logique Comptable Complète

### Retrait CDF avec Paiement Mixte

**Scénario :** Client retire 250,000 CDF, payé en 150,000 CDF cash + 100 USD cash (taux 1 USD = 2500 CDF)

**Écritures comptables :**

| Ligne | Compte | Portefeuille | Devise | Débit | Crédit | Description |
|-------|--------|--------------|--------|-------|--------|-------------|
| 1 | Service | Virtuel | CDF | 250,000 | - | Débit total du service |
| 2 | Cash | Cash | CDF | - | 150,000 | Sortie cash CDF |
| 3 | Service | Virtuel | CDF | - | 100,000 | Conversion CDF→USD |
| 4 | Service | Virtuel | USD | 100 | - | Conversion CDF→USD |
| 5 | Cash | Cash | USD | - | 100 | Sortie cash USD |

**Équilibre :**
- CDF : 250,000 = 150,000 + 100,000 ✅
- USD : 100 = 100 ✅

**Impact sur les soldes :**
- Service virtuel CDF : -250,000 CDF
- Service virtuel USD : -100 USD
- Cash CDF : +150,000 CDF
- Cash USD : +100 USD

### Dépôt CDF avec Réception Mixte

**Scénario :** Client dépose 250,000 CDF, reçu en 150,000 CDF cash + 100 USD cash (taux 1 USD = 2500 CDF)

**Écritures comptables :**

| Ligne | Compte | Portefeuille | Devise | Débit | Crédit | Description |
|-------|--------|--------------|--------|-------|--------|-------------|
| 1 | Cash | Cash | CDF | 150,000 | - | Entrée cash CDF |
| 2 | Service | Virtuel | CDF | 100,000 | - | Conversion USD→CDF |
| 3 | Service | Virtuel | USD | - | 100 | Conversion USD→CDF |
| 4 | Cash | Cash | USD | 100 | - | Entrée cash USD |
| 5 | Service | Virtuel | CDF | - | 250,000 | Crédit total du service |

**Équilibre :**
- CDF : 150,000 + 100,000 = 250,000 ✅
- USD : 100 = 100 ✅

**Impact sur les soldes :**
- Service virtuel CDF : +250,000 CDF
- Service virtuel USD : +100 USD
- Cash CDF : -150,000 CDF
- Cash USD : -100 USD

## Exemples de Validation

### Exemple 1 : Transaction Correcte

**Configuration :**
- Taux CDF→USD : 0.0004 (soit 1 USD = 2500 CDF)

**Transaction :**
- Type : Retrait
- Montant total : 250,000 CDF
- Paiement : 150,000 CDF + 100 USD

**Validation :**
```
✅ CDF équilibré: 250,000 = 150,000 + 100,000
✅ USD équilibré: 100 = 100
✅ Transaction validée avec succès
```

### Exemple 2 : Transaction avec Montant USD Incorrect

**Transaction :**
- Type : Retrait
- Montant total : 250,000 CDF
- Paiement : 150,000 CDF + **110 USD** (incorrect, devrait être 100)

**Validation :**
```
❌ Montant USD incorrect. Attendu: 100.00 USD pour 100000.00 CDF
   au taux 1 USD = 2,500.00 CDF (taux interne: 1 CDF = 0.000400 USD)
```

### Exemple 3 : Transaction avec Déséquilibre CDF

**Transaction :**
- Type : Retrait
- Montant total : 250,000 CDF
- Paiement : **140,000 CDF** + 100 USD (incorrect, devrait être 150,000)

**Validation :**
```
❌ Transaction non équilibrée pour CDF: débits=250000.00 CDF, crédits=240000.00 CDF
```

## Tests de Régression

### Test 1 : Retrait CDF Mixte

```sql
-- Transaction : Retrait 250,000 CDF payé en 150,000 CDF + 100 USD (taux 2500)
SELECT create_transaction_mixte_retrait_cdf(
  p_service_id := 'uuid-service',
  p_montant_total_cdf := 250000,
  p_montant_paye_cdf := 150000,
  p_montant_paye_usd := 100,
  p_info_client := 'Test retrait CDF mixte',
  p_created_by := 'uuid-user'
);
-- ✅ Résultat attendu : Transaction créée et validée
```

### Test 2 : Dépôt CDF Mixte

```sql
-- Transaction : Dépôt 540,000 CDF reçu en 340,000 CDF + 80 USD (taux 2500)
SELECT create_transaction_mixte_depot_cdf(
  p_service_id := 'uuid-service',
  p_montant_total_cdf := 540000,
  p_montant_recu_cdf := 340000,
  p_montant_recu_usd := 80,
  p_info_client := 'Test dépôt CDF mixte',
  p_created_by := 'uuid-user'
);
-- ✅ Résultat attendu : Transaction créée et validée
```

### Test 3 : Retrait CDF 100% USD

```sql
-- Transaction : Retrait 250,000 CDF payé entièrement en USD (taux 2500)
SELECT create_transaction_mixte_retrait_cdf(
  p_service_id := 'uuid-service',
  p_montant_total_cdf := 250000,
  p_montant_paye_cdf := 0,
  p_montant_paye_usd := 100,
  p_info_client := 'Test retrait 100% USD',
  p_created_by := 'uuid-user'
);
-- ✅ Résultat attendu : Transaction créée et validée
```

### Test 4 : Vérification des Soldes

```sql
-- Vérifier que les soldes sont correctement mis à jour
SELECT
  nom_service,
  solde_virtuel_cdf,
  solde_virtuel_usd
FROM services
WHERE id = 'uuid-service';

SELECT
  cash_cdf,
  cash_usd
FROM global_balances;

-- ✅ Les soldes doivent refléter correctement les transactions
```

## Fichiers Modifiés

### Backend (Migrations SQL)

1. **`20260122100000_fix_transaction_balance_validation_by_currency.sql`**
   - Correction de `validate_transaction_balance` pour validation par devise
   - Messages d'erreur détaillés par devise

2. **`20260122101500_fix_transaction_mixte_cdf_add_conversion_lines.sql`**
   - Correction de `create_transaction_mixte_retrait_cdf`
   - Correction de `create_transaction_mixte_depot_cdf`
   - Ajout des lignes de conversion CDF↔USD
   - Mise à jour des soldes virtuels USD

## Avantages de la Correction

1. **Validation Mathématiquement Correcte**
   - Chaque devise est équilibrée indépendamment
   - Pas de mélange de devises dans les calculs

2. **Traçabilité des Conversions**
   - Les lignes de conversion sont explicites dans les écritures
   - Facile de comprendre comment les devises sont échangées

3. **Messages d'Erreur Précis**
   - Indique quelle devise n'est pas équilibrée
   - Affiche les montants exacts de déséquilibre

4. **Gestion des Soldes Virtuels**
   - Les soldes USD et CDF sont maintenant tous deux mis à jour
   - Reflet précis de la position de change du service

5. **Flexibilité**
   - Supporte les transactions 100% CDF, 100% USD ou mixtes
   - Fonctionne avec n'importe quel taux de change

## Bonnes Pratiques

1. **Toujours utiliser le taux correct**
   - CDF→USD pour les transactions avec CDF comme devise principale
   - USD→CDF pour les transactions avec USD comme devise principale

2. **Vérifier les montants avant validation**
   - Utiliser l'auto-calcul dans le formulaire
   - Ne pas saisir manuellement les montants complémentaires

3. **Surveiller les taux de change**
   - S'assurer que les deux taux (USD→CDF et CDF→USD) sont configurés
   - Vérifier la cohérence des taux pour éviter les pertes

4. **Auditer les transactions mixtes**
   - Consulter régulièrement les lignes de conversion
   - Vérifier que les soldes virtuels USD et CDF restent cohérents

## Support Technique

En cas de problème avec les transactions mixtes :

1. Vérifier que les deux taux de change sont configurés
2. Consulter les messages d'erreur détaillés
3. Vérifier l'équilibre de chaque devise séparément
4. Utiliser les requêtes de diagnostic :

```sql
-- Voir les lignes d'une transaction
SELECT * FROM transaction_lines WHERE header_id = 'uuid-transaction';

-- Vérifier l'équilibre par devise
SELECT
  devise,
  SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END) AS total_debit,
  SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END) AS total_credit
FROM transaction_lines
WHERE header_id = 'uuid-transaction'
GROUP BY devise;
```

---

**Document maintenu par :** Équipe Développement Himaya CBS
**Dernière mise à jour :** 22 janvier 2026
**Version :** 1.0
