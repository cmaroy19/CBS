# Rapport Complet - Système de Transactions Mixtes et Corrections

**Date de création** : 24 décembre 2024
**Version** : 2.0
**Statut** : Production

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture du système](#architecture-du-système)
3. [Système de taux de change](#système-de-taux-de-change)
4. [Transactions multi-lignes](#transactions-multi-lignes)
5. [Transactions mixtes (Forex)](#transactions-mixtes-forex)
6. [Système de correction](#système-de-correction)
7. [Mise à jour des soldes](#mise-à-jour-des-soldes)
8. [Sécurité et permissions](#sécurité-et-permissions)
9. [Guide utilisateur](#guide-utilisateur)
10. [Maintenance et requêtes](#maintenance-et-requêtes)
11. [Historique des migrations](#historique-des-migrations)

---

## 1. Vue d'ensemble

### Objectif

Le système permet de gérer des transactions financières complexes impliquant plusieurs devises (USD et CDF) avec des paiements mixtes, tout en maintenant une comptabilité en partie double rigoureuse et une traçabilité complète.

### Fonctionnalités principales

- **Taux de change configurables** : Système de gestion des taux USD/CDF avec historique
- **Transactions simples** : Dépôts et retraits standard (une seule devise)
- **Transactions mixtes** : Paiements combinés USD + CDF avec conversion automatique
- **Système de correction** : Annulation et correction de toutes les transactions avec traçabilité
- **Comptabilité en partie double** : Équilibre automatique débits = crédits
- **Mise à jour automatique des soldes** : Triggers database pour cohérence garantie

### Types de transactions supportés

| Type | Description | Tables utilisées |
|------|-------------|------------------|
| **Simple** | Dépôt ou retrait dans une seule devise | `transactions` |
| **Mixte** | Paiement USD + CDF avec taux de change | `transaction_headers` + `transaction_lines` |

---

## 2. Architecture du système

### Schéma de base de données

```
┌─────────────────────┐
│  exchange_rates     │  ← Configuration des taux de change
├─────────────────────┤
│ - devise_source     │
│ - devise_destination│
│ - taux             │
│ - actif            │
└─────────────────────┘
         │
         ↓ (utilisé par)
┌─────────────────────┐     ┌─────────────────────┐
│ transaction_headers │────→│ transaction_lines   │
├─────────────────────┤     ├─────────────────────┤
│ - reference         │     │ - header_id         │
│ - type_operation    │     │ - type_portefeuille │
│ - montant_total     │     │ - service_id        │
│ - taux_change       │     │ - devise            │
│ - statut            │     │ - sens (debit/credit)│
│ - transaction_      │     │ - montant           │
│   origine_id        │     └─────────────────────┘
└─────────────────────┘              │
         │                           │
         └───────────────────────────┼─────→ UPDATE
                                     │
                            ┌────────┴──────────┐
                            │                   │
                    ┌───────▼────────┐  ┌──────▼────────┐
                    │ services       │  │global_balances│
                    ├────────────────┤  ├───────────────┤
                    │solde_virtuel_* │  │ cash_usd      │
                    └────────────────┘  │ cash_cdf      │
                                        └───────────────┘

Ancienne table (toujours utilisée pour transactions simples):
┌─────────────────────┐
│   transactions      │
├─────────────────────┤
│ - type (depot/retrait)
│ - service_id        │
│ - montant           │
│ - devise            │
│ - annule            │
│ - transaction_      │
│   origine_id        │
└─────────────────────┘
```

### Principes de conception

1. **Immutabilité** : Les transactions validées ne sont jamais modifiées
2. **Traçabilité** : Tout changement est enregistré avec utilisateur, date et raison
3. **Atomicité** : Les opérations multi-étapes sont garanties (tout ou rien)
4. **Cohérence** : Les triggers garantissent l'équilibre et la justesse des soldes
5. **Sécurité** : RLS policies strictes par rôle utilisateur

---

## 3. Système de taux de change

### Table `exchange_rates`

Stocke tous les taux de change configurés avec leur période de validité.

#### Colonnes principales

| Colonne | Type | Description |
|---------|------|-------------|
| `devise_source` | text | Devise source (USD, CDF) |
| `devise_destination` | text | Devise destination (USD, CDF) |
| `taux` | numeric | Taux de change (ex: 2700 = 1 USD = 2700 CDF) |
| `actif` | boolean | Si ce taux est actif (un seul actif par paire) |
| `date_debut` | timestamptz | Date de début de validité |
| `date_fin` | timestamptz | Date de fin de validité (optionnel) |

#### Contraintes

- Un seul taux actif par paire de devises à la fois
- Le taux doit être positif
- Les devises source et destination doivent être différentes
- `date_fin` doit être supérieure à `date_debut` si définie

#### Fonction clé : `get_active_exchange_rate()`

```sql
SELECT get_active_exchange_rate('USD', 'CDF');
-- Retourne: 2700 (ou NULL si aucun taux actif)
```

Cette fonction :
1. Cherche un taux actif pour la paire demandée
2. Si non trouvé, cherche l'inverse et retourne `1/taux`
3. Vérifie les dates de validité

#### Trigger de gestion

Le trigger `trigger_ensure_single_active_rate` désactive automatiquement les anciens taux lorsqu'un nouveau taux est activé pour la même paire.

### Permissions

- **Lecture** : Tous les utilisateurs authentifiés
- **Création/Modification** : Gérants, Propriétaires, Administrateurs uniquement

---

## 4. Transactions multi-lignes

### Table `transaction_headers`

Contient les informations globales de chaque transaction composée.

#### Colonnes principales

| Colonne | Type | Description |
|---------|------|-------------|
| `reference` | text | Référence unique (TRX-YYYYMM-XXXX) |
| `type_operation` | text | depot, retrait, approvisionnement, change, transfert |
| `devise_reference` | text | Devise de référence (USD, CDF) |
| `montant_total` | numeric | Montant total de la transaction |
| `taux_change` | numeric | Taux figé au moment de la transaction |
| `paire_devises` | text | Paire utilisée (ex: "USD/CDF") |
| `statut` | text | brouillon, validee, annulee |
| `transaction_origine_id` | uuid | Pour les corrections : lien vers l'original |
| `raison_correction` | text | Raison de la correction |
| `corrigee_par` | uuid | Utilisateur ayant fait la correction |
| `corrigee_le` | timestamptz | Date de la correction |

### Table `transaction_lines`

Contient les lignes de transaction équilibrées (débits = crédits).

#### Colonnes principales

| Colonne | Type | Description |
|---------|------|-------------|
| `header_id` | uuid | Lien vers transaction_headers |
| `ligne_numero` | integer | Numéro de ligne dans la transaction |
| `type_portefeuille` | text | cash (caisse globale) ou virtuel (service) |
| `service_id` | uuid | ID du service (pour type_portefeuille = virtuel) |
| `devise` | text | USD ou CDF |
| `sens` | text | debit (sortie) ou credit (entrée) |
| `montant` | numeric | Montant de la ligne |
| `description` | text | Description de la ligne |

### Principes comptables

Chaque transaction doit respecter la **partie double** :
```
Σ(débits) = Σ(crédits)
```

La fonction `validate_transaction_balance()` vérifie cet équilibre avant validation.

### Génération automatique de référence

La fonction `generate_transaction_reference()` génère des références uniques :
- Format : `TRX-YYYYMM-XXXX`
- Exemple : `TRX-202412-0001`
- Incrémentation automatique par mois

---

## 5. Transactions mixtes (Forex)

### Concept

Une transaction mixte permet de payer ou recevoir un montant en USD en utilisant une combinaison de USD et CDF, avec conversion au taux de change actif.

### Exemple : Retrait de 58 USD

**Scénario** : Un client veut retirer 58 USD, mais vous n'avez que 50 USD en caisse.

**Solution** : Paiement mixte
- Montant total : 58 USD
- Payé en USD : 50 USD
- Payé en CDF : 17,600 CDF (équivalent à 8 USD au taux de 2200)

**Écritures comptables créées** :

| Ligne | Type | Service/Cash | Devise | Sens | Montant | Description |
|-------|------|--------------|--------|------|---------|-------------|
| 1 | virtuel | Illico Cash | USD | débit | 58 USD | Débit service virtuel |
| 2 | cash | Global | USD | crédit | 50 USD | Crédit cash USD |
| 3 | cash | Global | CDF | crédit | 17,600 CDF | Crédit cash CDF |

**Vérification** :
- Débits = 58 USD
- Crédits = 50 USD + (17,600 CDF / 2200) = 50 USD + 8 USD = 58 USD ✓

### Fonctions principales

#### `create_transaction_mixte_retrait()`

Crée une transaction de retrait avec paiement mixte.

**Paramètres** :
- `p_service_id` : Service concerné
- `p_montant_total_usd` : Montant total du retrait
- `p_montant_paye_usd` : Partie payée en USD
- `p_montant_paye_cdf` : Partie payée en CDF
- `p_info_client` : Informations client
- `p_created_by` : Utilisateur créant la transaction

**Validations** :
1. Solde virtuel du service suffisant
2. Cash USD suffisant
3. Cash CDF suffisant
4. Taux de change actif disponible
5. Montant CDF correspond au montant USD restant × taux

**Actions** :
1. Crée le `transaction_header`
2. Crée les lignes équilibrées
3. Valide la transaction
4. Met à jour les soldes (via trigger)

#### `create_transaction_mixte_depot()`

Même principe pour les dépôts, avec sens inversé.

### Impact sur les soldes

**Pour un retrait mixte de 58 USD (50 USD + 17,600 CDF)** :
- Solde virtuel du service : **-58 USD**
- Cash USD global : **+50 USD**
- Cash CDF global : **+17,600 CDF**

**Pour un dépôt mixte de 58 USD (50 USD + 17,600 CDF)** :
- Solde virtuel du service : **+58 USD**
- Cash USD global : **-50 USD**
- Cash CDF global : **-17,600 CDF**

---

## 6. Système de correction

### Principe général

Le système permet d'annuler n'importe quelle transaction (simple ou mixte) en créant une **transaction inverse** qui ramène les soldes à leur état initial.

**Important** :
- La transaction originale n'est jamais supprimée
- Une transaction de correction inverse tous les mouvements
- La traçabilité complète est conservée

### Pour transactions simples

#### Table concernée : `transactions`

Fonction utilisée : `creer_correction_transaction()`

**Processus** :
1. Vérifie que la transaction existe et n'est pas déjà annulée
2. Crée une transaction inverse (dépôt → retrait ou retrait → dépôt)
3. Marque la transaction originale `annule = true`
4. Enregistre l'utilisateur, la date et la raison
5. Les soldes sont ajustés par le trigger existant

**Exemple** :

Transaction originale :
```
- Type: RETRAIT
- Service: Illico Cash
- Montant: 100 USD
```

Transaction de correction :
```
- Type: DEPOT
- Service: Illico Cash
- Montant: 100 USD
- transaction_origine_id: uuid-de-l'original
- raison_correction: "Montant erroné"
```

### Pour transactions mixtes

#### Tables concernées : `transaction_headers` + `transaction_lines`

Fonction utilisée : `creer_correction_transaction_mixte()`

**Processus** :
1. Vérifie que la transaction header existe et n'est pas annulée
2. Copie le header avec statut `validee`
3. **Inverse toutes les lignes** : débit ↔ crédit
4. Conserve montants, devises, taux de change
5. Marque l'original `statut = 'annulee'`
6. Les soldes sont ajustés par le trigger `update_balances_from_transaction_lines()`

**Exemple** :

Transaction originale (retrait mixte 58 USD) :

| Ligne | Type | Devise | Sens | Montant |
|-------|------|--------|------|---------|
| 1 | virtuel | USD | débit | 58 USD |
| 2 | cash | USD | crédit | 50 USD |
| 3 | cash | CDF | crédit | 17,600 CDF |

Transaction de correction (inverse) :

| Ligne | Type | Devise | Sens | Montant |
|-------|------|--------|------|---------|
| 1 | virtuel | USD | **crédit** | 58 USD |
| 2 | cash | USD | **débit** | 50 USD |
| 3 | cash | CDF | **débit** | 17,600 CDF |

**Résultat** : Tous les soldes reviennent à leur état d'origine.

### Colonnes de traçabilité

Ajoutées aux deux tables (`transactions` et `transaction_headers`) :

| Colonne | Description |
|---------|-------------|
| `transaction_origine_id` | UUID de la transaction originale (si correction) |
| `raison_correction` | Raison obligatoire saisie par l'utilisateur |
| `corrigee_par` | ID de l'utilisateur ayant fait la correction |
| `corrigee_le` | Date et heure de la correction |

Pour `transactions` : champ supplémentaire `annule` (boolean)
Pour `transaction_headers` : utilise le champ `statut` = 'annulee'

### Permissions

**Seuls** les rôles **Administrateur** et **Proprietaire** peuvent créer des corrections.

### Limitations

1. Une transaction ne peut être corrigée qu'**une seule fois**
2. Les corrections ne peuvent pas être annulées (nécessiterait une nouvelle correction)
3. Les transactions en brouillon ne peuvent pas être corrigées

---

## 7. Mise à jour des soldes

### Pour transactions simples

**Trigger** : `trigger_update_soldes_on_transaction`
**Table** : `transactions`

**Logique** :
- **DEPOT** : `cash_global ↑` et `solde_virtuel_service ↓`
- **RETRAIT** : `cash_global ↓` et `solde_virtuel_service ↑`

Ce trigger existe depuis le début du système.

### Pour transactions mixtes

**Trigger** : `trigger_update_balances_from_lines`
**Table** : `transaction_lines`
**Fonction** : `update_balances_from_transaction_lines()`

**Logique** :
- **DEBIT** : solde concerné **↓** (sortie)
- **CREDIT** : solde concerné **↑** (entrée)

**Type de portefeuille** :
- **cash** : Met à jour `global_balances.cash_usd` ou `cash_cdf`
- **virtuel** : Met à jour `services.solde_virtuel_usd` ou `solde_virtuel_cdf`

#### Détails de la fonction

```sql
CREATE OR REPLACE FUNCTION update_balances_from_transaction_lines()
RETURNS TRIGGER AS $$
DECLARE
  v_header_statut text;
  v_delta numeric;
  v_global_balance_id uuid;
BEGIN
  -- 1. Vérifier que la transaction est validée
  SELECT statut INTO v_header_statut
  FROM transaction_headers
  WHERE id = NEW.header_id;

  IF v_header_statut != 'validee' THEN
    RETURN NEW;  -- Ne rien faire si pas validée
  END IF;

  -- 2. Calculer le delta
  IF NEW.sens = 'debit' THEN
    v_delta := -NEW.montant;  -- Sortie
  ELSE
    v_delta := NEW.montant;   -- Entrée
  END IF;

  -- 3. Mettre à jour le solde approprié
  IF NEW.type_portefeuille = 'cash' THEN
    -- Récupérer l'ID de global_balances
    SELECT id INTO v_global_balance_id
    FROM global_balances LIMIT 1;

    -- Mettre à jour avec WHERE clause (OBLIGATOIRE)
    UPDATE global_balances
    SET cash_usd = cash_usd + v_delta  -- ou cash_cdf selon devise
    WHERE id = v_global_balance_id;

  ELSIF NEW.type_portefeuille = 'virtuel' THEN
    -- Mettre à jour le service
    UPDATE services
    SET solde_virtuel_usd = solde_virtuel_usd + v_delta  -- ou cdf
    WHERE id = NEW.service_id;
  END IF;

  RETURN NEW;
END;
$$;
```

#### Correction critique du 24 décembre 2024

**Problème** : L'UPDATE sur `global_balances` manquait une clause WHERE.

**Erreur** : "UPDATE requires a WHERE clause"

**Solution** :
1. Récupérer l'ID de `global_balances` avec le SELECT initial
2. Utiliser `WHERE id = v_global_balance_id` dans l'UPDATE
3. Garantit la conformité PostgreSQL même si la table a une seule ligne

**Migration** : `20251224165354_fix_trigger_add_where_clause_global_balances.sql`

### Garanties

- **Atomicité** : Soit toutes les lignes sont traitées, soit aucune
- **Cohérence** : Les soldes sont toujours équilibrés
- **Validation** : Le statut `validee` est vérifié avant mise à jour
- **Performance** : Les triggers s'exécutent en temps constant

---

## 8. Sécurité et permissions

### Row Level Security (RLS)

Toutes les tables ont RLS activé :
```sql
ALTER TABLE transaction_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
```

### Policies par table

#### `exchange_rates`

| Opération | Permission |
|-----------|------------|
| SELECT | Tous les utilisateurs authentifiés |
| INSERT | Gérant, Propriétaire, Administrateur |
| UPDATE | Gérant, Propriétaire, Administrateur |
| DELETE | Non autorisé |

#### `transaction_headers` et `transaction_lines`

| Opération | Permission |
|-----------|------------|
| SELECT | Tous les utilisateurs authentifiés |
| INSERT | Utilisateurs authentifiés actifs |
| UPDATE | Créateur uniquement, si statut = 'brouillon' |
| DELETE | Créateur uniquement, si statut = 'brouillon' |

#### `transactions` (table simple)

| Opération | Permission |
|-----------|------------|
| SELECT | Tous les utilisateurs authentifiés |
| INSERT | Caissier, Gérant, Propriétaire, Administrateur |
| UPDATE | Créateur uniquement |
| DELETE | Non autorisé |

### Fonctions SECURITY DEFINER

Les fonctions suivantes s'exécutent avec les privilèges du créateur :
- `create_transaction_mixte_retrait()`
- `create_transaction_mixte_depot()`
- `creer_correction_transaction()`
- `creer_correction_transaction_mixte()`

Cela permet de contourner les RLS policies tout en maintenant la sécurité via validation interne.

### Audit

Toutes les opérations critiques sont enregistrées dans `audit_logs` :
- Création de transaction
- Validation de transaction
- Correction de transaction
- Modification de taux de change

---

## 9. Guide utilisateur

### 9.1 Configurer un taux de change

**Accès** : Menu "Taux de change"
**Permissions** : Gérant, Propriétaire, Administrateur

**Étapes** :
1. Cliquer sur "Nouveau taux"
2. Saisir les informations :
   - Devise source : USD
   - Devise destination : CDF
   - Taux : 2700 (1 USD = 2700 CDF)
   - Cocher "Actif"
   - Date de début : aujourd'hui
   - Date de fin : laisser vide (illimité)
3. Sauvegarder

**Note** : L'ancien taux actif sera automatiquement désactivé.

### 9.2 Créer une transaction mixte

**Accès** : Menu "Transactions" > "Nouvelle transaction" > Onglet "Paiement mixte"

#### Exemple : Retrait de 58 USD

**Situation** : Le client veut 58 USD, mais vous n'avez que 50 USD en caisse.

**Étapes** :
1. Sélectionner le service (ex: Illico Cash)
2. Sélectionner "Retrait"
3. Montant total : **58** USD
4. Montant USD : **50** USD
5. Le système calcule automatiquement : **17,600** CDF (pour 8 USD au taux 2200)
6. Vérifier les soldes affichés
7. Saisir l'info client (nom, téléphone)
8. Cliquer "Valider"

**Résultat** :
- Une référence unique est générée (ex: TRX-202412-0023)
- Le solde virtuel du service diminue de 58 USD
- Le cash USD augmente de 50 USD
- Le cash CDF augmente de 17,600 CDF

#### Exemple : Dépôt de 100 USD

**Situation** : Le client dépose 100 USD en donnant 80 USD + 54,000 CDF.

**Étapes** :
1. Sélectionner le service
2. Sélectionner "Dépôt"
3. Montant total : **100** USD
4. Montant USD reçu : **80** USD
5. Montant CDF reçu : **54,000** CDF (pour 20 USD au taux 2700)
6. Valider

**Résultat** :
- Le solde virtuel du service augmente de 100 USD
- Le cash USD diminue de 80 USD
- Le cash CDF diminue de 54,000 CDF

### 9.3 Corriger une transaction

**Accès** : Menu "Transactions" > Bouton "Corriger" sur la ligne concernée
**Permissions** : Administrateur, Propriétaire uniquement

**Cas d'usage** :
- Montant saisi incorrectement
- Mauvais service sélectionné
- Transaction en doublon
- Erreur de calcul

**Étapes** :
1. Identifier la transaction erronée dans la liste
2. Cliquer sur "Corriger" dans la colonne Actions
3. **Saisir obligatoirement la raison** de la correction
   - Exemple : "Montant erroné - devait être 48 USD au lieu de 58 USD"
4. Vérifier l'aperçu de l'action
5. Cliquer "Confirmer la correction"

**Ce qui se passe** :
- Une transaction inverse est créée automatiquement
- Tous les mouvements sont inversés (débit ↔ crédit)
- La transaction originale est marquée comme "Annulée"
- Les soldes reviennent à leur état d'origine
- L'historique complet est conservé

**Traçabilité** :
- Utilisateur qui a fait la correction
- Date et heure
- Raison de la correction
- Lien vers la transaction originale

### 9.4 États des transactions

Dans la liste des transactions, vous pouvez voir :

| Badge | Signification |
|-------|---------------|
| **Validée** | Transaction normale, active |
| **Annulée** | Transaction corrigée, les soldes ont été rétablis |
| **Correction** | Transaction créée pour corriger une autre |
| **Brouillon** | Transaction non encore validée (transactions mixtes uniquement) |

### 9.5 Consulter l'historique

**Vue unifiée** : `v_all_transactions`

Cette vue combine :
- Transactions simples (`transactions`)
- Transactions mixtes (`transaction_headers`)

Toutes les colonnes importantes sont présentes :
- Référence
- Type d'opération
- Montant
- Devise
- Service
- Statut/Annulé
- Transaction origine (si correction)
- Raison de correction
- Corrigée par/le

---

## 10. Maintenance et requêtes

### 10.1 Requêtes utiles pour transactions simples

**Lister toutes les transactions annulées** :
```sql
SELECT *
FROM transactions
WHERE annule = true
ORDER BY corrigee_le DESC;
```

**Trouver les corrections d'une transaction** :
```sql
SELECT *
FROM transactions
WHERE transaction_origine_id = 'uuid-de-la-transaction'
```

**Statistiques des corrections par utilisateur** :
```sql
SELECT
  u.nom_complet,
  COUNT(*) as nombre_corrections
FROM transactions t
JOIN users u ON t.corrigee_par = u.id
WHERE t.annule = true
GROUP BY u.nom_complet
ORDER BY nombre_corrections DESC;
```

### 10.2 Requêtes pour transactions mixtes

**Lister toutes les transactions mixtes annulées** :
```sql
SELECT *
FROM transaction_headers
WHERE statut = 'annulee'
ORDER BY corrigee_le DESC;
```

**Voir les détails d'une transaction mixte avec ses lignes** :
```sql
SELECT
  h.reference,
  h.type_operation,
  h.montant_total,
  h.taux_change,
  h.statut,
  l.ligne_numero,
  l.type_portefeuille,
  l.devise,
  l.sens,
  l.montant,
  l.description
FROM transaction_headers h
JOIN transaction_lines l ON l.header_id = h.id
WHERE h.id = 'uuid-de-la-transaction'
ORDER BY l.ligne_numero;
```

**Vérifier l'équilibre d'une transaction** :
```sql
SELECT
  header_id,
  SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END) as total_debit,
  SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END) as total_credit,
  SUM(CASE WHEN sens = 'debit' THEN montant ELSE -montant END) as difference
FROM transaction_lines
WHERE header_id = 'uuid-de-la-transaction'
GROUP BY header_id;
-- difference doit être 0
```

### 10.3 Statistiques globales

**Transactions par type** :
```sql
SELECT
  'Simple' as type_transaction,
  COUNT(*) as total,
  SUM(CASE WHEN annule THEN 1 ELSE 0 END) as annulees
FROM transactions
UNION ALL
SELECT
  'Mixte' as type_transaction,
  COUNT(*) as total,
  SUM(CASE WHEN statut = 'annulee' THEN 1 ELSE 0 END) as annulees
FROM transaction_headers;
```

**Volume de transactions mixtes par mois** :
```sql
SELECT
  TO_CHAR(created_at, 'YYYY-MM') as mois,
  COUNT(*) as nombre_transactions,
  SUM(montant_total) as volume_total_usd
FROM transaction_headers
WHERE devise_reference = 'USD'
  AND statut = 'validee'
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY mois DESC;
```

**Raisons de correction les plus fréquentes** :
```sql
(
  SELECT raison_correction, COUNT(*) as occurrences
  FROM transactions
  WHERE transaction_origine_id IS NOT NULL
  GROUP BY raison_correction
)
UNION ALL
(
  SELECT raison_correction, COUNT(*) as occurrences
  FROM transaction_headers
  WHERE transaction_origine_id IS NOT NULL
  GROUP BY raison_correction
)
ORDER BY occurrences DESC;
```

### 10.4 Contrôles d'intégrité

**Vérifier que tous les headers ont des lignes équilibrées** :
```sql
SELECT
  h.id,
  h.reference,
  h.statut,
  SUM(CASE WHEN l.sens = 'debit' THEN l.montant ELSE 0 END) as debits,
  SUM(CASE WHEN l.sens = 'credit' THEN l.montant ELSE 0 END) as credits,
  SUM(CASE WHEN l.sens = 'debit' THEN l.montant ELSE -l.montant END) as diff
FROM transaction_headers h
LEFT JOIN transaction_lines l ON l.header_id = h.id
WHERE h.statut = 'validee'
GROUP BY h.id, h.reference, h.statut
HAVING ABS(SUM(CASE WHEN l.sens = 'debit' THEN l.montant ELSE -l.montant END)) > 0.01;
-- Ne doit retourner aucune ligne
```

**Vérifier les soldes calculés** :
```sql
-- Calculer le solde théorique basé sur les transactions
WITH solde_calcule AS (
  SELECT
    service_id,
    SUM(CASE
      WHEN type = 'depot' THEN -montant
      WHEN type = 'retrait' THEN montant
    END) as solde_virtuel_calcule_usd
  FROM transactions
  WHERE devise = 'USD' AND annule = false
  GROUP BY service_id
)
SELECT
  s.nom as service,
  s.solde_virtuel_usd as solde_actuel,
  COALESCE(sc.solde_virtuel_calcule_usd, 0) as solde_calcule,
  s.solde_virtuel_usd - COALESCE(sc.solde_virtuel_calcule_usd, 0) as difference
FROM services s
LEFT JOIN solde_calcule sc ON sc.service_id = s.id
WHERE ABS(s.solde_virtuel_usd - COALESCE(sc.solde_virtuel_calcule_usd, 0)) > 0.01;
-- Ne doit retourner aucune ligne si tout est cohérent
```

### 10.5 Nettoyage et optimisation

**Supprimer les transactions en brouillon de plus de 7 jours** :
```sql
DELETE FROM transaction_headers
WHERE statut = 'brouillon'
  AND created_at < now() - INTERVAL '7 days';
```

**Analyser les performances** :
```sql
-- Index utilisés
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as nombre_utilisations,
  idx_tup_read as lignes_lues,
  idx_tup_fetch as lignes_retournees
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('transaction_headers', 'transaction_lines', 'transactions')
ORDER BY idx_scan DESC;
```

---

## 11. Historique des migrations

### Phase 1 : Système de taux de change (21 décembre 2024)

**Migration** : `20251221110939_20251221_add_exchange_rates_system.sql`

**Ajouts** :
- Table `exchange_rates`
- Fonction `get_active_exchange_rate()`
- Trigger `ensure_single_active_rate`
- Vue `v_active_exchange_rates`
- Taux par défaut USD/CDF = 2700

**Objectif** : Permettre la configuration dynamique des taux de change.

### Phase 2 : Transactions multi-lignes (21 décembre 2024)

**Migration** : `20251221111951_20251221_create_multi_line_transactions.sql`

**Ajouts** :
- Table `transaction_headers`
- Table `transaction_lines`
- Fonction `generate_transaction_reference()`
- Fonction `validate_transaction_balance()`
- Fonction `valider_transaction()`
- Vue `v_transactions_completes`
- RLS policies complètes

**Objectif** : Infrastructure pour comptabilité en partie double.

### Phase 3 : Corrections pour génération de référence (21 décembre)

**Migrations** :
- `20251221113907_fix_transactions_reference_generation.sql`
- `20251221121035_fix_generate_reference_remove_old_trigger.sql`
- `20251221121046_fix_generate_reference_create_text_function.sql`
- `20251221125649_recreate_transactions_reference_trigger.sql`

**Corrections** :
- Type de retour de la fonction de génération (text au lieu de void)
- Suppression des triggers conflictuels
- Recréation propre du système de référence

### Phase 4 : Triggers de mise à jour des soldes (21 décembre)

**Migrations** :
- `20251221114536_add_multi_line_transaction_triggers.sql`
- `20251221115018_update_trigger_handle_change_portfolio.sql`
- `20251221115423_fix_trigger_function_definition.sql`
- `20251221120348_fix_complete_rebuild_trigger_function.sql`

**Évolution** :
- Première version du trigger de mise à jour des soldes
- Corrections successives pour gérer les types de portefeuille
- Gestion des débits/crédits
- Ajout du type 'change' dans `type_portefeuille`

### Phase 5 : RLS et permissions (21 décembre)

**Migrations** :
- `20251221120502_fix_rls_policy_allow_validation.sql`
- `20251221121507_add_change_to_type_portefeuille.sql`

**Corrections** :
- Policies pour permettre la validation par gérants/admins
- Extension du type `type_portefeuille` pour inclure 'change'

### Phase 6 : Fonctions de transactions mixtes (22 décembre)

**Migration** : `20251221092742_create_transaction_mixte_forex.sql`

**Ajouts** :
- `create_transaction_mixte_retrait()`
- `create_transaction_mixte_depot()`

**Objectif** : Permettre les paiements combinés USD + CDF avec conversion automatique.

### Phase 7 : Corrections de logique métier (22 décembre)

**Migrations** :
- `20251222093718_fix_transaction_balance_validation_forex.sql`
- `20251222100029_fix_balance_update_logic_for_mixed_transactions.sql`
- `20251222100412_fix_debit_credit_sens_in_mixed_transactions.sql`
- `20251222100803_fix_mixed_transactions_align_with_old_logic.sql`

**Corrections** :
- Validation des montants avec tolérance de 0.01
- Logique correcte de débit/crédit pour soldes
- Alignement avec le comportement des transactions simples

### Phase 8 : Système de correction (22 décembre)

**Migration** : `20251222081500_20251222_add_transaction_corrections.sql`

**Ajouts** :
- Colonnes de correction dans `transactions`
- Fonction `creer_correction_transaction()`
- Index pour performance
- RLS policies pour corrections

**Objectif** : Permettre l'annulation et la correction des transactions simples.

### Phase 9 : Vue unifiée et corrections mixtes (24 décembre)

**Migrations** :
- `20251224164432_fix_correction_add_source_field.sql`
- `20251224164723_add_correction_to_transaction_headers.sql`
- `20251224164742_update_view_with_correction_columns.sql`
- `20251224164848_add_trigger_update_balances_transaction_lines.sql`

**Ajouts** :
- Colonnes de correction dans `transaction_headers`
- Fonction `creer_correction_transaction_mixte()`
- Vue `v_all_transactions` unifiée
- Trigger `update_balances_from_transaction_lines()`

**Objectif** : Étendre les corrections aux transactions mixtes.

### Phase 10 : Correction critique du trigger (24 décembre)

**Migration** : `20251224165354_fix_trigger_add_where_clause_global_balances.sql`

**Problème** : UPDATE sans WHERE clause sur `global_balances`

**Solution** :
- Récupération de l'ID de `global_balances`
- Ajout de `WHERE id = v_global_balance_id`
- Conformité stricte avec PostgreSQL

**Impact** : Les corrections de transactions mixtes fonctionnent désormais sans erreur.

### Phase 11 : Dashboard et vues (22 décembre)

**Migrations** :
- `20251221125039_fix_dashboard_use_transaction_headers.sql`
- `20251221131126_create_service_balances_view.sql`
- `20251222091221_remove_automatic_commissions_from_dashboard.sql`

**Ajouts** :
- Vue `v_service_balances` pour affichage optimisé
- Mise à jour du dashboard pour utiliser les nouvelles tables
- Suppression du calcul automatique de commissions

### Phase 12 : Commissions et clôtures (22 décembre)

**Migrations** :
- `20251222090403_create_daily_commissions_table.sql`
- `20251222091720_create_daily_service_closures_table.sql`

**Ajouts** :
- Table `daily_commissions` pour enregistrer les commissions journalières
- Table `daily_service_closures` pour clôtures de service

**Objectif** : Gestion manuelle des commissions au lieu de calcul automatique.

### Phase 13 : Nettoyage et reset (22 décembre)

**Migration** : `20251222101601_reset_database_keep_services_v2.sql`

**Actions** :
- Suppression de toutes les transactions de test
- Conservation des services
- Conservation des taux de change
- Reset des soldes à zéro

**Objectif** : Préparer la base pour la production.

---

## Résumé des fonctionnalités

### Ce que le système peut faire

- ✅ Configurer des taux de change USD/CDF avec historique
- ✅ Créer des transactions simples (dépôt/retrait) dans une devise
- ✅ Créer des transactions mixtes avec paiement USD + CDF
- ✅ Calculer automatiquement les montants en CDF selon le taux
- ✅ Valider l'équilibre comptable (débits = crédits)
- ✅ Mettre à jour automatiquement tous les soldes (cash et virtuels)
- ✅ Corriger n'importe quelle transaction (simple ou mixte)
- ✅ Tracer toutes les corrections avec utilisateur, date et raison
- ✅ Consulter l'historique complet via une vue unifiée
- ✅ Générer des références uniques auto-incrémentées
- ✅ Figer le taux de change au moment de chaque transaction
- ✅ Gérer les permissions par rôle utilisateur
- ✅ Garantir l'intégrité des données via RLS et triggers

### Ce que le système garantit

- ✅ Aucune transaction validée n'est jamais modifiée directement
- ✅ Les soldes sont toujours cohérents (atomicité garantie)
- ✅ La comptabilité est équilibrée (débits = crédits)
- ✅ L'historique complet est conservé (audit trail)
- ✅ Les corrections sont traçables à 100%
- ✅ Les taux de change sont figés par transaction
- ✅ Un seul taux actif par paire de devises à la fois
- ✅ Les opérations sont sécurisées par rôle

---

## Documents connexes

- **GUIDE_TRANSACTIONS_MIXTES_FOREX.md** : Guide utilisateur pour transactions mixtes
- **SYSTEME_CORRECTION_TRANSACTIONS.md** : Vue technique du système de correction
- **TRANSACTION_CORRECTIONS.md** : Guide détaillé des corrections
- **TRANSACTIONS_REFACTORING.md** : Architecture technique du système

---

## Support et contact

Pour toute question ou problème :

1. Consulter ce rapport complet
2. Vérifier les logs d'audit en cas d'erreur
3. Utiliser les requêtes de maintenance pour diagnostiquer
4. Contacter l'administrateur système si nécessaire

---

**Fin du rapport**

**Version** : 2.0
**Date** : 24 décembre 2024
**Statut** : Production
**Auteur** : Système de gestion financière Himaya
