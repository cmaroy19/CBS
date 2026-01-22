# Système de Taux de Change Bidirectionnels

> Documentation technique du système de gestion des taux de change distincts USD/CDF et CDF/USD
> Date : 22 janvier 2026
> Version : 2.0

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture du système](#2-architecture-du-système)
3. [Modèle de données](#3-modèle-de-données)
4. [Logique métier](#4-logique-métier)
5. [Guide d'utilisation](#5-guide-dutilisation)
6. [Exemples pratiques](#6-exemples-pratiques)
7. [Migration depuis l'ancien système](#7-migration-depuis-lancien-système)
8. [Maintenance et dépannage](#8-maintenance-et-dépannage)
9. [Correction du Calcul CDF→USD](#9-correction-du-calcul-cdfusd-22-janvier-2026)
10. [Correction de l'Équilibre Comptable](#10-correction-de-léquilibre-comptable-22-janvier-2026)

---

## 1. Vue d'ensemble

### 1.1 Contexte

Le système précédent gérait un seul taux de change actif par paire de devises et utilisait automatiquement l'inverse (1/taux) lorsque la direction opposée était demandée. Cette approche ne permettait pas de :

- Gérer des marges commerciales distinctes entre achat et vente
- Avoir des taux différents selon le sens de conversion
- Refléter les réalités du marché des changes

### 1.2 Nouveau système

Le système amélioré permet de configurer **deux taux distincts simultanément** :

- **USD → CDF** : Taux pour convertir USD en CDF (ex: 1 USD = 2200 CDF)
- **CDF → USD** : Taux pour convertir CDF en USD (ex: 1 CDF = 0.000444 USD, soit 1 USD = 2250 CDF)

Cette configuration permet une **marge commerciale** entre l'achat et la vente de devises.

### 1.3 Avantages

- Flexibilité totale dans la gestion des taux
- Marge commerciale configurable
- Conformité aux pratiques de marché
- Traçabilité complète des changements de taux
- Support des transactions mixtes dans les deux sens

---

## 2. Architecture du système

### 2.1 Composants principaux

```
┌──────────────────────────────────────────────────────────────┐
│                     INTERFACE UTILISATEUR                     │
├──────────────────────────────────────────────────────────────┤
│  • TauxChange.tsx : Gestion des taux                         │
│  • TransactionMixteForm.tsx : Transactions multi-devises     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                     COUCHE MÉTIER                             │
├──────────────────────────────────────────────────────────────┤
│  • get_active_exchange_rate(source, dest) : Taux actif       │
│  • check_bidirectional_rates_configured() : Vérification     │
│  • initialize_bidirectional_rates() : Initialisation         │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                     BASE DE DONNÉES                           │
├──────────────────────────────────────────────────────────────┤
│  TABLE: exchange_rates                                        │
│  - devise_source : USD | CDF                                  │
│  - devise_destination : CDF | USD                             │
│  - taux : numeric                                             │
│  - actif : boolean                                            │
│                                                               │
│  VUES:                                                        │
│  - v_active_exchange_rates : Taux actifs formatés           │
│  - v_exchange_rates_summary : Résumé avec marge              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Flux de données

**Configuration d'un taux :**
```
1. Utilisateur crée/modifie un taux → Interface TauxChange
2. Validation (taux > 0, devises différentes)
3. INSERT/UPDATE dans exchange_rates
4. Trigger: Désactivation des autres taux actifs pour même paire
5. Rechargement automatique du résumé
```

**Utilisation dans une transaction :**
```
1. Utilisateur sélectionne devise de référence (USD ou CDF)
2. Chargement du taux actif pour devise_source → devise_destination
3. Calcul automatique du montant complémentaire
4. Création de la transaction avec taux gelé
5. Écriture comptable équilibrée
```

---

## 3. Modèle de données

### 3.1 Table `exchange_rates`

**Champs principaux :**

| Champ | Type | Description |
|-------|------|-------------|
| `id` | uuid | Identifiant unique |
| `devise_source` | text | Devise source (USD, CDF) |
| `devise_destination` | text | Devise destination (CDF, USD) |
| `taux` | numeric | Taux de conversion (> 0) |
| `actif` | boolean | Taux actif ou non |
| `date_debut` | timestamptz | Date de début de validité |
| `date_fin` | timestamptz | Date de fin (nullable) |
| `notes` | text | Notes complémentaires |

**Contraintes :**
```sql
CHECK (taux > 0)
CHECK (devise_source != devise_destination)
CHECK (devise_source IN ('USD', 'CDF'))
CHECK (devise_destination IN ('USD', 'CDF'))
CHECK (date_fin IS NULL OR date_fin > date_debut)
```

**Trigger :**
- `ensure_single_active_rate` : Un seul taux actif par paire à la fois

### 3.2 Vue `v_exchange_rates_summary`

Résumé des taux actifs avec calcul de la marge :

```sql
SELECT
  usd_to_cdf.taux AS taux_usd_to_cdf,
  cdf_to_usd.taux AS taux_cdf_to_usd,
  ROUND((1.0 / cdf_to_usd.taux) - usd_to_cdf.taux, 2) AS ecart_taux,
  ROUND((((1.0 / cdf_to_usd.taux) - usd_to_cdf.taux) / usd_to_cdf.taux * 100), 2) AS marge_pct
FROM ...
```

**Exemple de résultat :**
```
taux_usd_to_cdf: 2200
taux_cdf_to_usd: 0.000444444 (équiv: 1 USD = 2250 CDF)
ecart_taux: 50 CDF
marge_pct: 2.27%
```

---

## 4. Logique métier

### 4.1 Fonction `get_active_exchange_rate`

**Nouveau comportement :**
```sql
CREATE OR REPLACE FUNCTION get_active_exchange_rate(
  p_devise_source text,
  p_devise_destination text
)
RETURNS numeric AS $$
DECLARE
  v_taux numeric;
BEGIN
  -- Cherche UNIQUEMENT le taux dans le sens demandé
  SELECT taux INTO v_taux
  FROM exchange_rates
  WHERE devise_source = p_devise_source
  AND devise_destination = p_devise_destination
  AND actif = true
  AND date_debut <= now()
  AND (date_fin IS NULL OR date_fin > now())
  LIMIT 1;

  -- Retourne le taux ou NULL si non trouvé
  RETURN v_taux;
END;
$$ LANGUAGE plpgsql;
```

**⚠️ Changement important :**
- Ne cherche PLUS l'inverse automatiquement
- Retourne NULL si aucun taux n'existe pour la direction demandée
- Force la configuration explicite des deux sens

### 4.2 Fonction `check_bidirectional_rates_configured`

Vérifie si les deux sens sont configurés :

```sql
SELECT * FROM check_bidirectional_rates_configured();
```

**Résultat :**
```
usd_to_cdf_configured: true
cdf_to_usd_configured: true
usd_to_cdf_rate: 2200
cdf_to_usd_rate: 0.000444444
both_configured: true
```

### 4.3 Fonction `initialize_bidirectional_rates`

Initialise automatiquement le taux manquant avec l'inverse :

```sql
SELECT initialize_bidirectional_rates();
```

**Comportement :**
- Si seul USD→CDF existe : Crée CDF→USD = 1/USD→CDF
- Si seul CDF→USD existe : Crée USD→CDF = 1/CDF→USD
- Si aucun n'existe : Aucune action
- Si les deux existent : Aucune action

---

## 5. Guide d'utilisation

### 5.1 Configuration initiale

#### Étape 1 : Accéder au module Taux de Change

1. Se connecter en tant que **Gérant**, **Propriétaire** ou **Administrateur**
2. Naviguer vers **Taux de Change** dans le menu

#### Étape 2 : Créer le taux USD → CDF

1. Cliquer sur **Nouveau taux**
2. Remplir le formulaire :
   - Devise source : **USD**
   - Devise destination : **CDF**
   - Taux : **2200** (exemple)
   - Actif : **Coché**
   - Notes : "Taux d'achat USD - Vente CDF"
3. Cliquer sur **Créer**

#### Étape 3 : Créer le taux CDF → USD

1. Cliquer sur **Nouveau taux**
2. Remplir le formulaire :
   - Devise source : **CDF**
   - Devise destination : **USD**
   - Taux : **2250** *(saisie normalisée)*
   - Actif : **Coché**
   - Notes : "Taux de vente USD - Achat CDF (1 USD = 2250 CDF)"
3. Cliquer sur **Créer**

**💡 Note importante - Saisie normalisée :**
Pour les taux CDF → USD, le système utilise une **saisie normalisée** pour simplifier l'utilisation :
- **Vous saisissez** : 2250 (le taux équivalent "1 USD = 2250 CDF")
- **Le système enregistre** : 0.000444444 (taux interne = 1/2250)
- **Le système affiche** : 2250 (valeur normalisée pour faciliter la lecture)

Cette approche évite de manipuler des décimales complexes (0.000444) et permet de saisir directement le taux équivalent en CDF par USD.

#### Étape 4 : Vérifier le résumé

Le tableau de bord affiche maintenant :
- **USD → CDF** : 2200 (Achat USD)
- **CDF → USD** : 0.000444444 (Vente USD)
- **Marge commerciale** : 2.27% (50 CDF d'écart)

### 5.2 Création de transactions mixtes

#### Transaction avec référence USD

**Scénario :** Client retire 100 USD, payé avec 50 USD + 110,000 CDF

1. Aller sur **Transactions** → **Nouvelle transaction mixte**
2. Remplir :
   - Type : **Retrait**
   - Devise de référence : **USD**
   - Montant total : **100**
   - Montant USD : **50**
   - Le système calcule automatiquement : CDF = **110,000** (50 USD × 2200)
3. Le taux utilisé : **USD → CDF = 2200**
4. Validation : 50 + (110,000 / 2200) = 50 + 50 = 100 ✓

#### Transaction avec référence CDF

**Scénario :** Client dépose 225,000 CDF, reçu en 112,500 CDF + 50 USD

1. Aller sur **Transactions** → **Nouvelle transaction mixte**
2. Remplir :
   - Type : **Dépôt**
   - Devise de référence : **CDF**
   - Montant total : **225,000**
   - Montant CDF : **112,500**
   - Le système calcule automatiquement : USD = **50** (112,500 CDF / 2250)
3. Le taux utilisé : **CDF → USD = 0.000444444** (soit 1 USD = 2250 CDF)
4. Validation : 112,500 + (50 × 2250) = 112,500 + 112,500 = 225,000 ✓

### 5.3 Saisie normalisée pour les taux CDF → USD

#### Problématique

Les taux CDF → USD sont naturellement très petits (ex: 0.000444444), ce qui rend la saisie et la lecture difficiles et sujettes à erreurs.

#### Solution : Saisie normalisée

Le système utilise une **saisie normalisée** pour les taux CDF → USD uniquement :

| Aspect | Comportement |
|--------|--------------|
| **Saisie utilisateur** | Valeur > 1 représentant "1 USD = X CDF" (ex: 2500) |
| **Conversion interne** | `taux_interne = 1 / valeur_saisie` (ex: 1/2500 = 0.0004) |
| **Stockage base** | Taux interne (ex: 0.0004) |
| **Affichage interface** | Valeur normalisée (ex: 2500) |
| **Calculs transactions** | Utilise toujours le taux interne (0.0004) |

#### Exemple pratique

**Scénario :** Configurer un taux de vente USD à 2500 CDF

**Étapes :**
1. Ouvrir le formulaire "Nouveau taux"
2. Sélectionner :
   - Devise source : **CDF**
   - Devise destination : **USD**
3. Dans le champ "Taux de change", saisir : **2500**
4. Le système affiche en temps réel :
   - "1 USD = 2500 CDF (taux de vente)"
   - "Taux interne enregistré: 0.0004 (1 CDF = 0.0004 USD)"
5. Cliquer sur **Créer**

**Résultat en base de données :**
```sql
-- Enregistré dans la table exchange_rates
devise_source: 'CDF'
devise_destination: 'USD'
taux: 0.0004  -- Taux interne calculé automatiquement
```

**Affichage dans le tableau :**
- Colonne "Taux" : **2500** (valeur normalisée)
- Sous-texte : "(taux interne: 0.0004)"

#### Avantages

1. **Simplicité** : Saisie intuitive de valeurs familières (2500 au lieu de 0.0004)
2. **Réduction d'erreurs** : Évite les erreurs de décimales
3. **Cohérence visuelle** : Tous les taux affichés sont > 1
4. **Transparence** : Le taux interne reste visible pour vérification
5. **Calculs corrects** : Les transactions utilisent toujours le taux interne précis

#### Notes importantes

- Cette fonctionnalité s'applique **uniquement** aux taux CDF → USD
- Les taux USD → CDF sont saisis normalement (ex: 2200)
- Les calculs de transactions utilisent toujours le taux interne exact
- La conversion est automatique et transparente
- Les taux existants sont automatiquement convertis pour l'affichage

---

## 6. Exemples pratiques

### 6.1 Configuration avec marge commerciale

**Objectif :** Marge de 2% sur les opérations de change

**Calcul :**
- Taux de marché : 2200 CDF/USD
- Marge souhaitée : 2%
- Taux d'achat USD : 2200 (on achète l'USD du client)
- Taux de vente USD : 2200 × 1.02 = 2244 (on vend l'USD au client)

**Configuration via interface :**
1. **Taux USD → CDF** : Saisir **2200**
2. **Taux CDF → USD** : Saisir **2244** (saisie normalisée, converti en 1/2244 = 0.000445632 en interne)

**Configuration SQL directe :**
```sql
-- Taux d'achat USD (client vend USD)
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
VALUES ('USD', 'CDF', 2200, true, 'Taux achat USD - Marge 2%');

-- Taux de vente USD (client achète USD)
-- Note: Taux interne = 1/2244, mais saisie interface = 2244
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
VALUES ('CDF', 'USD', 1.0/2244, true, 'Taux vente USD - Marge 2%');
```

**Résultat :**
- Client dépose 100 USD : Reçoit crédit de 100 USD au taux 2200
- Client retire 100 USD : Paie en CDF au taux effectif de 2244 CDF/USD

### 6.2 Scénarios de transactions

#### Scénario 1 : Retrait USD mixte

**Client retire 58 USD, paie avec 50 USD cash + 17,600 CDF**

**Configuration système :**
- Taux USD → CDF : 2200

**Déroulement :**
1. Montant total : 58 USD
2. Paiement USD : 50 USD
3. Reste à payer : 8 USD
4. Équivalent CDF : 8 × 2200 = 17,600 CDF
5. Transaction validée ✓

**Écritures comptables :**
```
Ligne 1 : Débit  | Service virtuel | USD | 58      | "Débit service"
Ligne 2 : Crédit | Cash            | USD | 50      | "Crédit cash USD"
Ligne 3 : Crédit | Cash            | CDF | 17,600  | "Crédit cash CDF"
```

#### Scénario 2 : Dépôt CDF mixte

**Client dépose 200,000 CDF, reçu en 110,000 CDF + 40 USD**

**Configuration système :**
- Taux CDF → USD : 0.000444444 (équiv: 1 USD = 2250 CDF)

**Déroulement :**
1. Montant total : 200,000 CDF
2. Réception CDF : 110,000 CDF
3. Reste à recevoir : 90,000 CDF
4. Équivalent USD : 90,000 × 0.000444444 = 40 USD
5. Transaction validée ✓

**Écritures comptables :**
```
Ligne 1 : Débit  | Cash            | CDF | 110,000 | "Débit cash CDF"
Ligne 2 : Débit  | Cash            | USD | 40      | "Débit cash USD"
Ligne 3 : Crédit | Service virtuel | CDF | 200,000 | "Crédit service"
```

---

## 7. Migration depuis l'ancien système

### 7.1 Compatibilité

Le nouveau système est **rétrocompatible** :

- Les transactions existantes ne sont pas affectées (taux gelé dans `transaction_headers`)
- L'ancienne fonction est conservée sous le nom `get_exchange_rate_with_fallback`
- La migration s'effectue en douceur

### 7.2 Processus de migration

#### Phase 1 : Déploiement (Automatique)

```sql
-- Exécuté automatiquement par la migration
SELECT initialize_bidirectional_rates();
```

**Résultat :**
- Si taux USD→CDF existe : Crée automatiquement CDF→USD
- Si taux CDF→USD existe : Crée automatiquement USD→CDF

#### Phase 2 : Ajustement des taux (Manuel)

1. Vérifier les taux créés automatiquement
2. Ajuster si nécessaire pour ajouter une marge
3. Documenter les changements dans les notes

#### Phase 3 : Formation utilisateurs

- Expliquer le concept de taux bidirectionnels
- Montrer comment créer des transactions mixtes dans les deux sens
- Présenter le tableau de bord des taux

### 7.3 Rollback (si nécessaire)

Si besoin de revenir à l'ancien comportement :

```sql
-- Utiliser l'ancienne fonction avec fallback
SELECT get_exchange_rate_with_fallback('USD', 'CDF');
```

---

## 8. Maintenance et dépannage

### 8.1 Problèmes courants

#### Problème 1 : "Aucun taux actif trouvé"

**Symptôme :** Erreur lors de la création d'une transaction mixte

**Cause :** Taux manquant pour la direction demandée

**Solution :**
```sql
-- Vérifier les taux configurés
SELECT * FROM check_bidirectional_rates_configured();

-- Si un sens manque, le créer via l'interface ou:
SELECT initialize_bidirectional_rates();
```

#### Problème 2 : Taux incohérents

**Symptôme :** Marge commerciale anormale ou négative

**Cause :** Taux configurés dans le mauvais sens

**Solution :**
```sql
-- Vérifier le résumé
SELECT * FROM v_exchange_rates_summary;

-- Comparer avec les taux attendus
-- Corriger via l'interface si nécessaire
```

#### Problème 3 : Transaction déséquilibrée

**Symptôme :** Erreur "Transaction déséquilibrée"

**Cause :** Montants ne correspondent pas au taux

**Solution :**
1. Vérifier le taux actif utilisé
2. Recalculer les montants
3. Utiliser l'auto-calcul dans le formulaire

### 8.2 Requêtes de diagnostic

**Vérifier tous les taux actifs :**
```sql
SELECT * FROM v_active_exchange_rates;
```

**Voir l'historique des taux :**
```sql
SELECT
  devise_source,
  devise_destination,
  taux,
  actif,
  date_debut,
  date_fin,
  notes
FROM exchange_rates
WHERE devise_source IN ('USD', 'CDF')
AND devise_destination IN ('USD', 'CDF')
ORDER BY date_debut DESC;
```

**Calculer la marge actuelle :**
```sql
SELECT
  taux_usd_to_cdf,
  taux_cdf_to_usd,
  ROUND(1.0 / taux_cdf_to_usd, 2) AS taux_vente_usd_equiv,
  ecart_taux,
  marge_pct
FROM v_exchange_rates_summary;
```

### 8.3 Bonnes pratiques

1. **Toujours configurer les deux sens**
   - Ne jamais laisser un seul taux actif
   - Utiliser `initialize_bidirectional_rates()` si nécessaire

2. **Documenter les changements de taux**
   - Remplir systématiquement le champ `notes`
   - Indiquer la raison du changement

3. **Vérifier la marge régulièrement**
   - Consulter le résumé des taux quotidiennement
   - Ajuster selon les conditions du marché

4. **Historiser les taux**
   - Utiliser `date_fin` plutôt que de désactiver
   - Permet l'audit et l'analyse historique

5. **Tester avant de déployer**
   - Créer des transactions de test
   - Vérifier les calculs dans les deux sens

---

## 9. Correction du Calcul CDF→USD (22 janvier 2026)

### 9.1 Problème corrigé

Une erreur de logique dans les fonctions de transaction mixte CDF causait l'utilisation du mauvais taux de change.

#### Symptômes

Lors de transactions avec CDF comme devise principale :
- Message d'erreur : "Montant USD incorrect. Attendu: 108.70 USD pour 250000 CDF au taux 2300"
- Alors que le taux actif affiché était : "1 USD = 2,500 CDF"
- Impossibilité de créer des transactions avec taux de vente USD différent du taux d'achat

#### Cause racine

Les fonctions `create_transaction_mixte_retrait_cdf` et `create_transaction_mixte_depot_cdf` utilisaient :
- **Taux incorrect** : `get_active_exchange_rate('USD', 'CDF')` (taux d'achat USD)
- **Calcul incorrect** : Division au lieu de multiplication
- **Validation incorrecte** : Comparaison avec le mauvais taux

### 9.2 Solution implémentée

#### Avant la correction ❌

```sql
-- Utilisait le taux USD→CDF (ex: 2200)
v_taux_change := get_active_exchange_rate('USD', 'CDF');

-- Calculait incorrectement
v_montant_usd_equivalent := (p_montant_total_cdf - p_montant_paye_cdf) / v_taux_change;
-- Exemple: 100,000 CDF / 2200 = 45.45 USD ❌
```

#### Après la correction ✅

```sql
-- Utilise le taux CDF→USD (ex: 0.0004)
v_taux_change := get_active_exchange_rate('CDF', 'USD');

-- Calcule le taux pour affichage
v_taux_affichage := ROUND(1.0 / v_taux_change, 2);

-- Calcule correctement
v_montant_usd_equivalent := (p_montant_total_cdf - p_montant_paye_cdf) * v_taux_change;
-- Exemple: 100,000 CDF × 0.0004 = 40 USD ✅
```

### 9.3 Impact de la correction

#### Messages d'erreur améliorés

Les messages affichent maintenant le taux de manière compréhensible :

```sql
RAISE EXCEPTION 'Montant USD incorrect. Attendu: % USD pour % CDF au taux 1 USD = % CDF (taux interne: 1 CDF = % USD)',
  ROUND(v_montant_usd_equivalent, 2),  -- 40 USD
  (p_montant_total_cdf - p_montant_paye_cdf),  -- 100,000 CDF
  v_taux_affichage,  -- 2,500 CDF
  v_taux_change;     -- 0.0004 USD
```

#### Interface utilisateur cohérente

Le formulaire affiche le taux de la même manière que les messages d'erreur :

```
Taux actif: 1 USD = 2,500.00 CDF
(taux interne: 1 CDF = 0.000400 USD)
```

### 9.4 Exemples de validation

#### Exemple 1 : Transaction correcte

**Configuration :**
- Taux CDF→USD : 0.0004 (soit 1 USD = 2500 CDF)

**Transaction :**
- Total : 250,000 CDF
- Paiement CDF : 150,000 CDF
- Reste : 100,000 CDF

**Calcul :**
```
Montant USD = 100,000 × 0.0004 = 40 USD ✅
Validation : 150,000 + (40 ÷ 0.0004) = 150,000 + 100,000 = 250,000 ✅
```

#### Exemple 2 : Détection d'erreur

**Transaction avec montant incorrect :**
- Total : 250,000 CDF
- Paiement CDF : 150,000 CDF
- Paiement USD : **45 USD** (incorrect)

**Erreur générée :**
```
Montant USD incorrect. Attendu: 40.00 USD pour 100000.00 CDF
au taux 1 USD = 2,500.00 CDF (taux interne: 1 CDF = 0.000400 USD)
```

### 9.5 Tests de régression

Pour vérifier que la correction fonctionne correctement :

```sql
-- Test 1 : Retrait CDF avec paiement mixte
SELECT create_transaction_mixte_retrait_cdf(
  p_service_id := 'uuid-service',
  p_montant_total_cdf := 250000,
  p_montant_paye_cdf := 150000,
  p_montant_paye_usd := 40,
  p_info_client := 'Test CDF→USD',
  p_created_by := 'uuid-user'
);
-- Résultat attendu : Transaction créée avec succès ✅

-- Test 2 : Dépôt CDF avec réception mixte
SELECT create_transaction_mixte_depot_cdf(
  p_service_id := 'uuid-service',
  p_montant_total_cdf := 540000,
  p_montant_recu_cdf := 340000,
  p_montant_recu_usd := 80,
  p_info_client := 'Test CDF→USD dépôt',
  p_created_by := 'uuid-user'
);
-- Résultat attendu : Transaction créée avec succès ✅

-- Test 3 : Validation de montant incorrect
SELECT create_transaction_mixte_retrait_cdf(
  p_service_id := 'uuid-service',
  p_montant_total_cdf := 250000,
  p_montant_paye_cdf := 150000,
  p_montant_paye_usd := 45,  -- Incorrect (devrait être 40)
  p_info_client := 'Test validation',
  p_created_by := 'uuid-user'
);
-- Résultat attendu : Exception avec message clair ✅
```

### 9.6 Fichiers modifiés

**Backend :**
- Migration : `20260122090000_fix_transaction_mixte_cdf_use_correct_rate.sql`
  - Fonction `create_transaction_mixte_retrait_cdf` corrigée
  - Fonction `create_transaction_mixte_depot_cdf` corrigée

**Frontend :**
- Composant : `src/components/transactions/TransactionMixteForm.tsx`
  - Affichage normalisé du taux CDF→USD
  - Messages d'erreur cohérents avec la base de données

**Documentation :**
- `CORRECTION_TAUX_CDF_USD.md` : Documentation détaillée de la correction
- `SYSTEME_TAUX_BIDIRECTIONNELS.md` : Cette section ajoutée

### 9.7 Rétrocompatibilité

- Les transactions existantes ne sont **pas affectées** (taux gelé dans `transaction_headers`)
- Les calculs des transactions USD→CDF restent **inchangés**
- Seules les nouvelles transactions CDF→USD utilisent la logique corrigée

---

## 10. Correction de l'Équilibre Comptable (22 janvier 2026)

### 10.1 Problème corrigé

Après la correction du calcul des taux CDF→USD, une nouvelle erreur apparaissait :
```
Transaction non équilibrée: les débits ne sont pas égaux aux crédits
```

#### Causes racines

Deux problèmes distincts causaient cette erreur :

##### Problème 1 : Validation globale au lieu de par devise

La fonction `validate_transaction_balance` additionnait tous les montants ensemble sans distinction de devise :

```sql
-- ❌ Ancien code
total_debit = 250,000 CDF + 100 USD = 250,100  (non sens mathématique)
total_credit = 250,000 CDF + 100 USD = 250,100 (non sens mathématique)
```

##### Problème 2 : Lignes de conversion manquantes

Les écritures comptables ne contenaient pas de lignes de conversion entre USD et CDF, rendant impossible l'équilibre par devise.

**Exemple du problème :**
Transaction : Retrait 250,000 CDF payé en 150,000 CDF + 100 USD

**Écritures incorrectes :**
```
Débit service virtuel CDF : 250,000
Crédit cash CDF : 150,000
Crédit cash USD : 100
```

**Équilibre par devise :**
- CDF : 250,000 ≠ 150,000 ❌
- USD : 0 ≠ 100 ❌

### 10.2 Solutions implémentées

#### Solution 1 : Validation par devise séparée

```sql
-- ✅ Nouveau code
-- Vérifier USD séparément
IF ABS(v_debit_usd - v_credit_usd) > 0.01 THEN
  RAISE EXCEPTION 'Transaction non équilibrée pour USD: débits=% USD, crédits=% USD';
END IF;

-- Vérifier CDF séparément
IF ABS(v_debit_cdf - v_credit_cdf) > 0.01 THEN
  RAISE EXCEPTION 'Transaction non équilibrée pour CDF: débits=% CDF, crédits=% CDF';
END IF;
```

#### Solution 2 : Ajout des lignes de conversion

**Écritures correctes :**
Transaction : Retrait 250,000 CDF payé en 150,000 CDF + 100 USD (taux 2500)

```
Ligne 1 : Débit service virtuel CDF : 250,000 CDF
Ligne 2 : Crédit cash CDF : 150,000 CDF
Ligne 3 : Crédit service virtuel CDF : 100,000 CDF (conversion)
Ligne 4 : Débit service virtuel USD : 100 USD (conversion)
Ligne 5 : Crédit cash USD : 100 USD
```

**Équilibre par devise :**
- CDF : 250,000 = 150,000 + 100,000 ✅
- USD : 100 = 100 ✅

### 10.3 Logique comptable complète

#### Retrait CDF avec paiement mixte

| Ligne | Compte | Portefeuille | Devise | Débit | Crédit | Description |
|-------|--------|--------------|--------|-------|--------|-------------|
| 1 | Service | Virtuel | CDF | 250,000 | - | Débit total du service |
| 2 | Cash | Cash | CDF | - | 150,000 | Sortie cash CDF |
| 3 | Service | Virtuel | CDF | - | 100,000 | Conversion CDF→USD |
| 4 | Service | Virtuel | USD | 100 | - | Conversion CDF→USD |
| 5 | Cash | Cash | USD | - | 100 | Sortie cash USD |

**Signification des lignes de conversion :**
- **Ligne 3** : Le service récupère 100,000 CDF "virtuels" représentant la valeur CDF de 100 USD
- **Ligne 4** : Ces 100,000 CDF sont convertis en 100 USD qui sortent du service
- **Ligne 5** : Les 100 USD sont ajoutés au cash

### 10.4 Impact sur les soldes

Les fonctions mettent maintenant à jour **les deux soldes virtuels** :

```sql
UPDATE services
SET
  solde_virtuel_cdf = solde_virtuel_cdf - p_montant_total_cdf,
  solde_virtuel_usd = solde_virtuel_usd - p_montant_paye_usd,  -- ← Nouveau
  updated_at = now()
WHERE id = p_service_id;
```

Cela permet de :
- Suivre la position de change du service
- Éviter les décalages entre CDF et USD
- Faciliter l'audit des conversions

### 10.5 Fichiers modifiés

**Backend :**
- Migration : `20260122100000_fix_transaction_balance_validation_by_currency.sql`
  - Fonction `validate_transaction_balance` corrigée

- Migration : `20260122101500_fix_transaction_mixte_cdf_add_conversion_lines.sql`
  - Fonction `create_transaction_mixte_retrait_cdf` corrigée
  - Fonction `create_transaction_mixte_depot_cdf` corrigée

**Documentation :**
- `CORRECTION_EQUILIBRE_TRANSACTIONS_MIXTES.md` : Documentation détaillée

### 10.6 Tests de régression

```sql
-- Test 1 : Retrait CDF mixte (devrait passer)
SELECT create_transaction_mixte_retrait_cdf(
  p_service_id := 'uuid',
  p_montant_total_cdf := 250000,
  p_montant_paye_cdf := 150000,
  p_montant_paye_usd := 100
);

-- Test 2 : Vérifier l'équilibre par devise
SELECT
  devise,
  SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END) AS debit,
  SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END) AS credit
FROM transaction_lines
WHERE header_id = 'uuid-transaction'
GROUP BY devise;
-- Résultat attendu : debit = credit pour chaque devise
```

---

## Conclusion

Le système de taux bidirectionnels offre une flexibilité maximale pour gérer les opérations de change avec des marges commerciales distinctes. La migration depuis l'ancien système est transparente, et l'interface utilisateur a été conçue pour faciliter l'adoption.

### Points clés à retenir

- **Deux taux distincts** : USD→CDF et CDF→USD
- **Pas d'inversion automatique** : Configuration explicite requise
- **Marge commerciale** : Calculée automatiquement et affichée
- **Transactions mixtes** : Support complet dans les deux sens
- **Rétrocompatibilité** : Transactions existantes non affectées

### Support

Pour toute question ou problème, consulter ce document ou contacter l'équipe technique.

---

**Document maintenu par :** Équipe Développement Himaya CBS
**Dernière mise à jour :** 22 janvier 2026
**Version :** 2.0
