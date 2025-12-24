# Rapport Complet - Système de Transactions Simples et Mixtes

**Date de création** : 24 décembre 2024
**Version** : 3.0 (Complète)
**Statut** : Production

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture complète](#2-architecture-complète)
3. [Système de taux de change](#3-système-de-taux-de-change)
4. [Transactions simples](#4-transactions-simples)
5. [Transactions mixtes (Forex)](#5-transactions-mixtes-forex)
6. [Système de correction](#6-système-de-correction)
7. [Vue unifiée](#7-vue-unifiée)
8. [Interface utilisateur](#8-interface-utilisateur)
9. [Flux de données](#9-flux-de-données)
10. [Sécurité et permissions](#10-sécurité-et-permissions)
11. [Guide utilisateur complet](#11-guide-utilisateur-complet)
12. [Maintenance et diagnostic](#12-maintenance-et-diagnostic)

---

## 1. Vue d'ensemble

### 1.1 Objectif du système

Le système de gestion des transactions permet de traiter deux types d'opérations financières :

1. **Transactions simples** : Dépôts et retraits dans une seule devise (USD ou CDF)
2. **Transactions mixtes** : Paiements combinés USD + CDF avec conversion automatique

Le système garantit :
- La cohérence comptable (débits = crédits)
- La traçabilité complète de toutes les opérations
- La mise à jour automatique des soldes
- La possibilité de corriger toute transaction avec audit complet

### 1.2 Types de transactions supportés

| Type | Table(s) | Description | Exemple |
|------|----------|-------------|---------|
| **Transaction simple** | `transactions` | Opération dans une seule devise | Retrait de 100 USD en espèces USD |
| **Transaction mixte** | `transaction_headers` + `transaction_lines` | Paiement combiné avec conversion | Retrait de 58 USD payé en 50 USD + 17,600 CDF |

### 1.3 Fonctionnalités clés

- Configuration flexible des taux de change USD/CDF
- Calcul automatique des montants en CDF
- Validation des montants avec tolérance de 0.01
- Génération automatique de références uniques
- Correction de toutes les transactions avec traçabilité
- Vue unifiée des transactions simples et mixtes
- Interface utilisateur intuitive avec deux onglets

---

## 2. Architecture complète

### 2.1 Schéma de la base de données

```
┌─────────────────────────────────────────────────────────────┐
│                    TAUX DE CHANGE                          │
└─────────────────────────────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │ exchange_rates  │
                   ├─────────────────┤
                   │ devise_source   │
                   │ devise_destination │
                   │ taux            │
                   │ actif           │
                   └─────────────────┘
                            │
                            │ (utilisé par)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              TRANSACTIONS SIMPLES (Anciennes)              │
└─────────────────────────────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  transactions   │
                   ├─────────────────┤
                   │ type            │
                   │ service_id      │
                   │ montant         │
                   │ devise          │
                   │ annule          │
                   │ transaction_    │
                   │   origine_id    │
                   └─────────────────┘
                            │
                            │ (met à jour)
                            ↓
                   ┌─────────────────┐
                   │ services        │
                   │ global_balances │
                   └─────────────────┘

┌─────────────────────────────────────────────────────────────┐
│           TRANSACTIONS MIXTES (Nouvelles)                  │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
   ┌────────▼────────┐          ┌──────────▼──────────┐
   │transaction_     │─────────→│ transaction_lines   │
   │   headers       │          ├─────────────────────┤
   ├─────────────────┤          │ header_id           │
   │ reference       │          │ type_portefeuille   │
   │ type_operation  │          │ service_id          │
   │ montant_total   │          │ devise              │
   │ taux_change     │          │ sens (debit/credit) │
   │ statut          │          │ montant             │
   │ transaction_    │          └─────────────────────┘
   │   origine_id    │                     │
   │ raison_correction│                    │
   └─────────────────┘                     │
            │                              │
            │ (correction)                 │ (met à jour via trigger)
            │                              │
            └──────────────┬───────────────┘
                          ↓
                ┌─────────────────────┐
                │   services          │
                │   global_balances   │
                ├─────────────────────┤
                │ solde_virtuel_usd   │
                │ solde_virtuel_cdf   │
                │ cash_usd            │
                │ cash_cdf            │
                └─────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    VUE UNIFIÉE                             │
└─────────────────────────────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │v_all_transactions│
                   ├─────────────────┤
                   │ UNION de:       │
                   │ - transactions  │
                   │ - transaction_  │
                   │   headers       │
                   └─────────────────┘
                            │
                            ↓
                   [Interface utilisateur]
```

### 2.2 Tables principales

#### Table `exchange_rates`
Stocke les taux de change configurables.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Identifiant unique |
| devise_source | text | USD ou CDF |
| devise_destination | text | USD ou CDF |
| taux | numeric | Taux (ex: 2700 = 1 USD = 2700 CDF) |
| actif | boolean | Un seul actif par paire |
| date_debut | timestamptz | Date de début de validité |
| date_fin | timestamptz | Date de fin (optionnel) |
| notes | text | Commentaires |

#### Table `transactions` (transactions simples)
Anciennes transactions avec un seul mouvement.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Identifiant unique |
| reference | text | Référence unique auto-générée |
| type | text | depot ou retrait |
| service_id | uuid | Service concerné |
| montant | numeric | Montant |
| devise | text | USD ou CDF |
| info_client | text | Informations client |
| notes | text | Notes |
| annule | boolean | Si corrigée |
| transaction_origine_id | uuid | Lien vers original si correction |
| raison_correction | text | Raison de la correction |
| corrigee_par | uuid | Utilisateur correcteur |
| corrigee_le | timestamptz | Date de correction |

#### Table `transaction_headers` (en-têtes des transactions mixtes)
En-tête des transactions multi-lignes.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Identifiant unique |
| reference | text | Référence unique (TRX-YYYYMM-XXXX) |
| type_operation | text | depot, retrait, approvisionnement, change, transfert |
| devise_reference | text | Devise de référence (USD) |
| montant_total | numeric | Montant total |
| description | text | Description générée automatiquement |
| info_client | text | Informations client |
| taux_change | numeric | Taux figé |
| paire_devises | text | Ex: USD/CDF |
| statut | text | brouillon, validee, annulee |
| transaction_origine_id | uuid | Pour corrections |
| raison_correction | text | Raison de correction |
| corrigee_par | uuid | Utilisateur correcteur |
| corrigee_le | timestamptz | Date de correction |

#### Table `transaction_lines` (lignes des transactions mixtes)
Lignes équilibrées de chaque transaction.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | Identifiant unique |
| header_id | uuid | Lien vers transaction_headers |
| ligne_numero | integer | Numéro de ligne |
| type_portefeuille | text | cash ou virtuel |
| service_id | uuid | Service (pour virtuel) |
| devise | text | USD ou CDF |
| sens | text | debit (sortie) ou credit (entrée) |
| montant | numeric | Montant de la ligne |
| description | text | Description de la ligne |

---

## 3. Système de taux de change

### 3.1 Configuration des taux

Les taux de change sont configurables via l'interface "Taux de change" (accessible dans le menu).

**Caractéristiques** :
- Un seul taux actif par paire à la fois
- Historique complet des taux passés
- Période de validité configurable
- Notes pour documentation

**Trigger automatique** : Lorsqu'un nouveau taux est activé, l'ancien est automatiquement désactivé.

### 3.2 Fonction `get_active_exchange_rate()`

Récupère le taux actif pour une paire de devises.

```sql
SELECT get_active_exchange_rate('USD', 'CDF');
-- Retourne: 2700 (ou NULL)
```

**Logique** :
1. Cherche un taux actif pour USD → CDF
2. Si non trouvé, cherche CDF → USD et retourne 1/taux
3. Vérifie que la date est dans la période de validité

### 3.3 Permissions

| Rôle | Lecture | Création | Modification |
|------|---------|----------|--------------|
| Tous | Oui | Non | Non |
| Gérant | Oui | Oui | Oui |
| Propriétaire | Oui | Oui | Oui |
| Administrateur | Oui | Oui | Oui |

---

## 4. Transactions simples

### 4.1 Principe

Les transactions simples sont les opérations de base : dépôt ou retrait dans **une seule devise**.

**Exemples** :
- Dépôt de 100 USD (client apporte 100 USD en cash)
- Retrait de 50,000 CDF (client retire 50,000 CDF en cash)

### 4.2 Table utilisée

`transactions`

### 4.3 Impact sur les soldes

**Pour un DEPOT** :
- `global_balances.cash_{devise}` **diminue** (l'argent sort de la caisse)
- `services.solde_virtuel_{devise}` **augmente** (le crédit du service augmente)

**Pour un RETRAIT** :
- `global_balances.cash_{devise}` **augmente** (l'argent entre dans la caisse)
- `services.solde_virtuel_{devise}` **diminue** (le crédit du service diminue)

### 4.4 Trigger de mise à jour

`trigger_update_soldes_on_transaction`

Ce trigger met à jour automatiquement les soldes après chaque insertion dans `transactions`.

---

## 5. Transactions mixtes (Forex)

### 5.1 Principe

Une transaction mixte permet de payer ou recevoir un montant en USD en utilisant une **combinaison de USD et CDF**, avec conversion automatique au taux de change actif.

### 5.2 Cas d'usage typiques

#### Scénario 1 : Retrait mixte

**Situation** : Un client veut retirer 58 USD de son compte Illico Cash, mais la caisse n'a que 50 USD disponibles.

**Solution** : Paiement mixte
- Montant total : **58 USD**
- Payé en USD : **50 USD**
- Payé en CDF : **17,600 CDF** (équivalent à 8 USD au taux de 2200)

#### Scénario 2 : Dépôt mixte

**Situation** : Un client veut déposer 100 USD, mais n'a que 80 USD en espèces. Il complète avec des CDF.

**Solution** : Dépôt mixte
- Montant total : **100 USD**
- Reçu en USD : **80 USD**
- Reçu en CDF : **54,000 CDF** (équivalent à 20 USD au taux de 2700)

### 5.3 Architecture des transactions mixtes

#### Comptabilité en partie double

Chaque transaction mixte crée plusieurs **lignes équilibrées** :

```
Σ(débits) = Σ(crédits)
```

#### Exemple détaillé : Retrait de 58 USD (50 USD + 17,600 CDF)

**Écritures comptables créées** :

| Ligne | Type portefeuille | Service | Devise | Sens | Montant | Description |
|-------|-------------------|---------|--------|------|---------|-------------|
| 1 | virtuel | Illico Cash | USD | **débit** | 58 USD | Débit service virtuel |
| 2 | cash | Global | USD | **crédit** | 50 USD | Crédit cash USD |
| 3 | cash | Global | CDF | **crédit** | 17,600 CDF | Crédit cash CDF |

**Vérification de l'équilibre** :
- Débits = 58 USD
- Crédits = 50 USD + (17,600 / 2200) = 50 + 8 = 58 USD ✓

**Impact sur les soldes** :
- `services.solde_virtuel_usd` (Illico Cash) : **-58 USD**
- `global_balances.cash_usd` : **+50 USD**
- `global_balances.cash_cdf` : **+17,600 CDF**

### 5.4 Fonctions backend

#### Fonction `create_transaction_mixte_retrait()`

Crée une transaction de retrait avec paiement mixte.

**Signature** :
```sql
create_transaction_mixte_retrait(
  p_service_id uuid,
  p_montant_total_usd numeric,
  p_montant_paye_usd numeric,
  p_montant_paye_cdf numeric,
  p_info_client text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid  -- ID du transaction_header créé
```

**Validations effectuées** :
1. Montant total > 0
2. Montants USD et CDF >= 0
3. Au moins un montant > 0
4. Solde virtuel du service suffisant
5. Cash USD suffisant
6. Cash CDF suffisant
7. Taux de change actif disponible
8. **Validation du montant CDF** : `|montant_cdf_attendu - montant_cdf_fourni| <= 0.01`

**Actions** :
1. Récupère le taux de change actif
2. Vérifie la correspondance des montants
3. Crée le `transaction_header` avec statut 'brouillon'
4. Crée les lignes :
   - Ligne 1 : Débit du service virtuel USD
   - Ligne 2 : Crédit cash USD (si montant > 0)
   - Ligne 3 : Crédit cash CDF (si montant > 0)
5. Valide la transaction (statut → 'validee')
6. Les soldes sont mis à jour par le trigger `update_balances_from_transaction_lines()`

#### Fonction `create_transaction_mixte_depot()`

Même principe pour les dépôts, avec sens inversé.

**Paramètres** :
- `p_montant_recu_usd` : Montant reçu en USD
- `p_montant_recu_cdf` : Montant reçu en CDF

**Lignes créées** :
1. Débit cash USD (si montant > 0)
2. Débit cash CDF (si montant > 0)
3. Crédit du service virtuel USD

### 5.5 Trigger de mise à jour des soldes

#### Fonction `update_balances_from_transaction_lines()`

Trigger sur `transaction_lines` AFTER INSERT.

**Logique** :
1. Vérifie que le header est `validee`
2. Calcule le delta selon le sens :
   - `debit` → delta = **-montant** (sortie)
   - `credit` → delta = **+montant** (entrée)
3. Met à jour selon le type de portefeuille :
   - `cash` → met à jour `global_balances.cash_{devise}`
   - `virtuel` → met à jour `services.solde_virtuel_{devise}`

**Correction du 24 décembre 2024** : Ajout de la clause WHERE obligatoire pour l'UPDATE sur `global_balances`.

```sql
UPDATE global_balances
SET cash_usd = cash_usd + v_delta
WHERE id = v_global_balance_id;  -- WHERE clause OBLIGATOIRE
```

### 5.6 Génération de la référence

Chaque transaction mixte reçoit une référence unique au format :

```
TRX-YYYYMM-XXXX
```

**Exemple** : `TRX-202412-0023`

**Génération** : Fonction `generate_transaction_reference()` appelée automatiquement par un trigger BEFORE INSERT.

---

## 6. Système de correction

### 6.1 Principe général

Le système permet de **corriger** toute transaction (simple ou mixte) en créant une **transaction inverse**.

**Règles** :
- La transaction originale n'est jamais modifiée
- Une transaction de correction inverse tous les mouvements
- Traçabilité complète : utilisateur, date, raison
- Seuls les Administrateurs et Propriétaires peuvent créer des corrections

### 6.2 Correction de transactions simples

#### Fonction utilisée

`creer_correction_transaction(p_transaction_id, p_raison, p_user_id)`

#### Processus

1. Récupère la transaction originale
2. Vérifie qu'elle n'est pas déjà annulée
3. Crée une transaction inverse :
   - `depot` → `retrait`
   - `retrait` → `depot`
4. Même montant, même service, même devise
5. Marque l'original `annule = true`
6. Enregistre l'utilisateur, la date et la raison
7. Les soldes sont ajustés par le trigger existant

#### Exemple

**Transaction originale** :
```
Type: RETRAIT
Service: Illico Cash
Montant: 100 USD
```

**Transaction de correction** :
```
Type: DEPOT
Service: Illico Cash
Montant: 100 USD
transaction_origine_id: uuid-de-l'original
raison_correction: "Montant erroné"
```

**Résultat** : Les soldes reviennent à leur état d'origine.

### 6.3 Correction de transactions mixtes

#### Fonction utilisée

`creer_correction_transaction_mixte(p_header_id, p_raison, p_user_id)`

#### Processus

1. Récupère le header original
2. Vérifie qu'il n'est pas déjà annulé
3. Crée un nouveau header avec :
   - `statut = 'validee'`
   - `transaction_origine_id` = ID de l'original
   - `raison_correction` = raison fournie
4. Copie toutes les lignes en **inversant les sens** :
   - `debit` → `credit`
   - `credit` → `debit`
5. Conserve les montants, devises, services identiques
6. Marque l'original `statut = 'annulee'`
7. Les soldes sont ajustés par le trigger

#### Exemple

**Transaction originale** (retrait mixte 58 USD) :

| Ligne | Type | Devise | Sens | Montant |
|-------|------|--------|------|---------|
| 1 | virtuel | USD | débit | 58 USD |
| 2 | cash | USD | crédit | 50 USD |
| 3 | cash | CDF | crédit | 17,600 CDF |

**Transaction de correction** :

| Ligne | Type | Devise | Sens | Montant |
|-------|------|--------|------|---------|
| 1 | virtuel | USD | **crédit** | 58 USD |
| 2 | cash | USD | **débit** | 50 USD |
| 3 | cash | CDF | **débit** | 17,600 CDF |

**Résultat** : Tous les soldes reviennent à leur état d'origine.

### 6.4 Colonnes de traçabilité

| Colonne | Description |
|---------|-------------|
| `transaction_origine_id` | UUID de la transaction originale |
| `raison_correction` | Raison obligatoire de la correction |
| `corrigee_par` | ID de l'utilisateur correcteur |
| `corrigee_le` | Date et heure de la correction |

**Pour `transactions`** : Champ `annule` (boolean) supplémentaire
**Pour `transaction_headers`** : Champ `statut` = 'annulee'

---

## 7. Vue unifiée

### 7.1 Vue `v_all_transactions`

Cette vue combine les transactions simples et mixtes en une seule vue pour l'affichage.

**Structure** :
```sql
SELECT * FROM v_all_transactions
-- Retourne TOUTES les transactions (simples + mixtes)
```

**Colonnes communes** :
- `id`, `reference`, `type`, `service_id`
- `montant`, `devise`, `info_client`, `notes`
- `created_by`, `created_at`
- `is_mixed` : boolean pour distinguer les transactions mixtes
- `taux_change` : taux utilisé (pour les mixtes)
- `annule` / `statut`
- Colonnes de correction

**Source des données** :
- **Partie 1** : `transactions` (WHERE annule = false)
- **Partie 2** : `transaction_headers` (WHERE statut = 'validee')

**UNION ALL** : Les deux ensembles sont combinés.

### 7.2 Avantages

- Une seule requête pour afficher toutes les transactions
- Interface unifiée dans l'application
- Filtrage et recherche simplifiés
- Historique complet en un seul endroit

---

## 8. Interface utilisateur

### 8.1 Page Transactions

**Chemin** : `/transactions`

**Composants** :
- `Transactions.tsx` : Page principale
- `TransactionsForm.tsx` : Formulaire pour transactions simples
- `TransactionMixteForm.tsx` : Formulaire pour transactions mixtes
- `TransactionsTable.tsx` : Tableau d'affichage
- `TransactionCorrectionModal.tsx` : Modal de correction

### 8.2 Onglets de saisie

Lorsqu'on clique sur "Nouvelle transaction", un modal s'ouvre avec **deux onglets** :

#### Onglet 1 : Transaction simple

**Champs** :
- Type (Dépôt / Retrait)
- Service
- Montant
- Devise (USD / CDF)
- Info client (optionnel)
- Notes (optionnel)

**Soumission** : Insère directement dans la table `transactions`

#### Onglet 2 : Paiement mixte (Forex)

**Champs** :
- Type (Dépôt / Retrait)
- Service
- **Montant total (USD)** : montant à payer/recevoir
- **Montant en USD** : partie en USD
- **Montant en CDF** : partie en CDF (calculé automatiquement)
- Info client (optionnel)
- Notes (optionnel)

**Calcul automatique** :
- Checkbox "Calcul auto" activée par défaut
- Lorsque l'utilisateur saisit le montant USD, le montant CDF est calculé automatiquement :
  ```
  montant_cdf = (montant_total - montant_usd) × taux_change
  ```

**Affichage du taux actif** :
```
Taux actif: 1 USD = 2,700 CDF
```

**Récapitulatif** :
```
Montant USD:        50.00 USD
Reste à convertir:   8.00 USD
Équivalent CDF:  17,600.00 CDF
─────────────────────────────
Total:              58.00 USD
```

**Soumission** : Appelle la fonction `create_transaction_mixte_retrait()` ou `create_transaction_mixte_depot()`

### 8.3 Affichage des transactions

**Table** : Affiche toutes les transactions (simples + mixtes)

**Colonnes** :
- Date/Heure
- Référence
- Type
- Service
- Montant
- Devise
- Badge "Mixte" (pour les transactions mixtes)
- Info client
- Créé par
- Statut
- Actions (Corriger)

**Filtres** :
- Date : Sélecteur de date (affiche les transactions du jour par défaut)
- Recherche : Par référence

**Pagination** : 20 transactions par page

### 8.4 Badge de distinction

Les transactions mixtes affichent un badge spécial :

```
[Mixte] 50 USD + 17,600 CDF
```

### 8.5 Correction

**Bouton** : "Corriger" sur chaque ligne (visible uniquement pour Administrateur/Propriétaire)

**Modal de correction** :
1. Affiche les détails de la transaction
2. Demande une raison obligatoire
3. Affiche un aperçu de l'opération
4. Bouton "Confirmer la correction"

**Après validation** :
- La transaction originale est marquée "Annulée"
- Une transaction de correction est créée
- Les soldes sont rétablis
- La liste est rafraîchie

---

## 9. Flux de données

### 9.1 Flux pour transaction simple

```
┌──────────────────┐
│ Utilisateur      │
│ Saisit formulaire│
└────────┬─────────┘
         │
         ↓
┌────────────────────────────┐
│ INSERT INTO transactions   │
└────────┬───────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ TRIGGER: update_soldes_on_transaction│
└────────┬─────────────────────────────┘
         │
         ├──→ UPDATE global_balances
         └──→ UPDATE services
                    │
                    ↓
            Soldes mis à jour
```

### 9.2 Flux pour transaction mixte

```
┌──────────────────────────┐
│ Utilisateur              │
│ Saisit formulaire mixte  │
└────────┬─────────────────┘
         │
         ↓
┌────────────────────────────────────────┐
│ get_active_exchange_rate('USD', 'CDF') │
└────────┬───────────────────────────────┘
         │
         ↓ (taux = 2700)
┌────────────────────────────────────────┐
│ Validation côté client:                │
│ montant_cdf = reste_usd × taux         │
└────────┬───────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────┐
│ RPC: create_transaction_mixte_retrait()│
│ ou create_transaction_mixte_depot()    │
└────────┬───────────────────────────────┘
         │
         ├──→ INSERT transaction_headers (statut = brouillon)
         │
         ├──→ INSERT transaction_lines (ligne 1: debit virtuel)
         │    ↓ TRIGGER: update_balances_from_transaction_lines()
         │      (ne fait rien car statut != validee)
         │
         ├──→ INSERT transaction_lines (ligne 2: credit cash USD)
         │    ↓ TRIGGER: (ne fait rien car statut != validee)
         │
         ├──→ INSERT transaction_lines (ligne 3: credit cash CDF)
         │    ↓ TRIGGER: (ne fait rien car statut != validee)
         │
         ├──→ valider_transaction(header_id, user_id)
         │    ↓ UPDATE transaction_headers SET statut = 'validee'
         │
         ├──→ MAINTENANT les triggers se déclenchent rétroactivement
         │
         ├──→ UPDATE services.solde_virtuel_usd
         ├──→ UPDATE global_balances.cash_usd
         └──→ UPDATE global_balances.cash_cdf
                    │
                    ↓
            Soldes mis à jour
```

### 9.3 Flux de correction

```
┌──────────────────────────┐
│ Utilisateur clique       │
│ "Corriger"               │
└────────┬─────────────────┘
         │
         ↓
┌────────────────────────────────────┐
│ Modal de confirmation              │
│ + saisie de la raison              │
└────────┬───────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────┐
│ creer_correction_transaction()             │
│ ou creer_correction_transaction_mixte()    │
└────────┬───────────────────────────────────┘
         │
         ├──→ Création transaction inverse
         │    (tous les sens sont inversés)
         │
         ├──→ Marquage original comme annulée
         │
         └──→ Les triggers mettent à jour les soldes
                    │
                    ↓
            Soldes rétablis à l'état d'origine
```

---

## 10. Sécurité et permissions

### 10.1 Row Level Security (RLS)

Toutes les tables ont RLS activé.

### 10.2 Permissions par table

#### `exchange_rates`

| Rôle | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Caissier | Oui | Non | Non | Non |
| Gérant | Oui | Oui | Oui | Non |
| Propriétaire | Oui | Oui | Oui | Non |
| Administrateur | Oui | Oui | Oui | Non |

#### `transactions`

| Rôle | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Tous | Oui | Non | Non | Non |
| Caissier | Oui | Oui | Créateur uniquement | Non |
| Gérant | Oui | Oui | Créateur uniquement | Non |
| Propriétaire | Oui | Oui | Oui | Non |
| Administrateur | Oui | Oui | Oui | Non |

#### `transaction_headers` et `transaction_lines`

| Rôle | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Tous | Oui | Non | Non | Non |
| Utilisateur actif | Oui | Oui | Si brouillon + créateur | Si brouillon + créateur |
| Gérant | Oui | Oui | Oui | Non |
| Propriétaire | Oui | Oui | Oui | Non |
| Administrateur | Oui | Oui | Oui | Non |

### 10.3 Fonctions SECURITY DEFINER

Les fonctions suivantes s'exécutent avec les privilèges du propriétaire de la base :
- `create_transaction_mixte_retrait()`
- `create_transaction_mixte_depot()`
- `creer_correction_transaction()`
- `creer_correction_transaction_mixte()`

Cela permet de contourner les RLS tout en maintenant la sécurité via validations internes.

### 10.4 Corrections

**Seuls** les rôles **Administrateur** et **Proprietaire** peuvent créer des corrections.

Vérification dans l'interface :
```typescript
const canCorrect = user?.role === 'administrateur' || user?.role === 'proprietaire';
```

---

## 11. Guide utilisateur complet

### 11.1 Configurer un taux de change

**Accès** : Menu "Taux de change"

**Étapes** :
1. Cliquer sur "Nouveau taux"
2. Sélectionner :
   - Devise source : **USD**
   - Devise destination : **CDF**
3. Saisir le taux : **2700** (signifie 1 USD = 2700 CDF)
4. Cocher "Taux actif"
5. Date de début : **aujourd'hui** (ou date spécifique)
6. Date de fin : laisser vide (illimité) ou définir une date
7. Notes : optionnel (ex: "Taux du marché officiel")
8. Cliquer "Créer"

**Résultat** : L'ancien taux actif est automatiquement désactivé.

### 11.2 Créer une transaction simple

**Accès** : Menu "Transactions" > "Nouvelle transaction" > Onglet "Transaction simple"

**Exemple : Retrait de 100 USD**

1. Type : **Retrait**
2. Service : **Illico Cash**
3. Montant : **100**
4. Devise : **USD**
5. Info client : "Jean Dupont - 0812345678" (optionnel)
6. Notes : optionnel
7. Cliquer "Créer la transaction"

**Impact** :
- Solde virtuel Illico Cash : **+100 USD** (le client retire donc son crédit augmente)
- Cash global USD : **-100 USD** (l'argent sort de la caisse)

### 11.3 Créer une transaction mixte

**Accès** : Menu "Transactions" > "Nouvelle transaction" > Onglet "Paiement mixte (Forex)"

#### Exemple 1 : Retrait de 58 USD avec paiement mixte

**Contexte** : Le client veut 58 USD, mais vous n'avez que 50 USD en caisse.

**Étapes** :
1. Type : **Retrait**
2. Service : **Illico Cash**
3. Montant total (USD) : **58**
4. Montant en USD : **50**
5. Le système calcule automatiquement : **Montant en CDF : 17,600** (pour 8 USD au taux 2200)

**Récapitulatif affiché** :
```
Taux actif: 1 USD = 2,200 CDF

Montant USD:        50.00 USD
Reste à convertir:   8.00 USD
Équivalent CDF:  17,600.00 CDF
─────────────────────────────
Total:              58.00 USD
```

6. Info client : "Marie Kambale - 0899887766"
7. Notes : optionnel
8. Cliquer "Créer la transaction"

**Impact** :
- Solde virtuel Illico Cash : **-58 USD**
- Cash global USD : **+50 USD**
- Cash global CDF : **+17,600 CDF**

**Référence générée** : `TRX-202412-0023`

#### Exemple 2 : Dépôt de 100 USD avec paiement mixte

**Contexte** : Le client veut déposer 100 USD mais n'a que 80 USD en espèces. Il complète avec 54,000 CDF.

**Étapes** :
1. Type : **Dépôt**
2. Service : **Airtel Money**
3. Montant total (USD) : **100**
4. Montant en USD : **80**
5. Le système calcule automatiquement : **Montant en CDF : 54,000** (pour 20 USD au taux 2700)
6. Cliquer "Créer la transaction"

**Impact** :
- Solde virtuel Airtel Money : **+100 USD**
- Cash global USD : **-80 USD**
- Cash global CDF : **-54,000 CDF**

### 11.4 Corriger une transaction

**Accès** : Menu "Transactions" > Bouton "Corriger" sur la ligne

**Permissions** : Administrateur ou Propriétaire uniquement

#### Correction d'une transaction simple

**Exemple** : Vous avez saisi 100 USD au lieu de 90 USD

**Étapes** :
1. Trouver la transaction dans la liste
2. Cliquer sur "Corriger" dans la colonne Actions
3. Une modal s'ouvre avec les détails
4. Saisir la raison : **"Montant erroné - devait être 90 USD"**
5. Vérifier l'aperçu de l'opération
6. Cliquer "Confirmer la correction"

**Résultat** :
- Transaction originale marquée "Annulée"
- Transaction de correction créée (retrait → dépôt ou dépôt → retrait)
- Soldes rétablis
- Vous pouvez maintenant créer la bonne transaction (90 USD)

#### Correction d'une transaction mixte

**Exemple** : Vous avez créé une transaction mixte par erreur

**Étapes** :
1. Cliquer sur "Corriger" sur la transaction mixte
2. Saisir la raison : **"Transaction en doublon"**
3. Cliquer "Confirmer la correction"

**Résultat** :
- Transaction originale : `statut = 'annulee'`
- Nouvelle transaction de correction créée avec toutes les lignes inversées :
  - débit → crédit
  - crédit → débit
- Tous les soldes (virtuel USD, cash USD, cash CDF) reviennent à leur état d'origine

### 11.5 Consulter l'historique

**Accès** : Menu "Transactions"

**Filtres disponibles** :
- **Date** : Affiche les transactions d'un jour spécifique
- **Recherche** : Par référence (ex: "TRX-202412-0023")

**Badges de statut** :

| Badge | Signification |
|-------|---------------|
| Validée | Transaction normale, active |
| Annulée | Transaction corrigée |
| Mixte | Transaction avec paiement USD + CDF |
| Correction | Transaction créée pour corriger une autre |

**Détails affichés** :
- Date et heure
- Référence
- Type (Dépôt / Retrait)
- Service
- Montant total
- Devise
- Badge "Mixte" (si applicable)
- Info client
- Créé par
- Statut

---

## 12. Maintenance et diagnostic

### 12.1 Vérifier les soldes

#### Comparer les soldes calculés vs enregistrés

```sql
-- Pour les transactions simples
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
-- Ne doit retourner aucune ligne
```

#### Vérifier l'équilibre des transactions mixtes

```sql
SELECT
  h.reference,
  SUM(CASE WHEN l.sens = 'debit' THEN l.montant ELSE 0 END) as total_debit,
  SUM(CASE WHEN l.sens = 'credit' THEN l.montant ELSE 0 END) as total_credit,
  SUM(CASE WHEN l.sens = 'debit' THEN l.montant ELSE -l.montant END) as difference
FROM transaction_headers h
JOIN transaction_lines l ON l.header_id = h.id
WHERE h.statut = 'validee'
GROUP BY h.reference
HAVING ABS(SUM(CASE WHEN l.sens = 'debit' THEN l.montant ELSE -l.montant END)) > 0.01;
-- Ne doit retourner aucune ligne
```

### 12.2 Statistiques

#### Nombre de transactions par type

```sql
SELECT
  'Simple' as type_transaction,
  COUNT(*) as total,
  SUM(CASE WHEN annule THEN 1 ELSE 0 END) as annulees,
  COUNT(*) - SUM(CASE WHEN annule THEN 1 ELSE 0 END) as actives
FROM transactions

UNION ALL

SELECT
  'Mixte' as type_transaction,
  COUNT(*) as total,
  SUM(CASE WHEN statut = 'annulee' THEN 1 ELSE 0 END) as annulees,
  SUM(CASE WHEN statut = 'validee' THEN 1 ELSE 0 END) as actives
FROM transaction_headers;
```

#### Volume de transactions mixtes par mois

```sql
SELECT
  TO_CHAR(created_at, 'YYYY-MM') as mois,
  COUNT(*) as nombre_transactions,
  SUM(montant_total) as volume_total_usd,
  AVG(montant_total) as montant_moyen
FROM transaction_headers
WHERE statut = 'validee'
  AND devise_reference = 'USD'
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY mois DESC;
```

#### Raisons de correction les plus fréquentes

```sql
SELECT
  raison_correction,
  COUNT(*) as occurrences
FROM (
  SELECT raison_correction
  FROM transactions
  WHERE transaction_origine_id IS NOT NULL

  UNION ALL

  SELECT raison_correction
  FROM transaction_headers
  WHERE transaction_origine_id IS NOT NULL
) corrections
GROUP BY raison_correction
ORDER BY occurrences DESC;
```

### 12.3 Audit des corrections

#### Corrections par utilisateur

```sql
SELECT
  u.nom_complet,
  COUNT(*) as nombre_corrections,
  MIN(t.corrigee_le) as premiere_correction,
  MAX(t.corrigee_le) as derniere_correction
FROM (
  SELECT corrigee_par, corrigee_le
  FROM transactions
  WHERE annule = true

  UNION ALL

  SELECT corrigee_par, corrigee_le
  FROM transaction_headers
  WHERE statut = 'annulee'
) t
JOIN users u ON u.id = t.corrigee_par
GROUP BY u.nom_complet
ORDER BY nombre_corrections DESC;
```

#### Dernières corrections

```sql
SELECT
  'Simple' as type,
  t.reference,
  t.raison_correction,
  u.nom_complet as corrigee_par,
  t.corrigee_le
FROM transactions t
JOIN users u ON u.id = t.corrigee_par
WHERE t.annule = true

UNION ALL

SELECT
  'Mixte' as type,
  h.reference,
  h.raison_correction,
  u.nom_complet as corrigee_par,
  h.corrigee_le
FROM transaction_headers h
JOIN users u ON u.id = h.corrigee_par
WHERE h.statut = 'annulee'

ORDER BY corrigee_le DESC
LIMIT 20;
```

---

## Résumé des fonctionnalités

### Ce que le système peut faire

- ✅ Gérer deux types de transactions : simples et mixtes
- ✅ Configurer des taux de change USD/CDF avec historique
- ✅ Calculer automatiquement les montants en CDF
- ✅ Valider l'équilibre comptable (débits = crédits)
- ✅ Générer des références uniques auto-incrémentées
- ✅ Mettre à jour automatiquement tous les soldes
- ✅ Corriger toute transaction avec traçabilité complète
- ✅ Afficher toutes les transactions dans une vue unifiée
- ✅ Filtrer par date ou rechercher par référence
- ✅ Distinguer visuellement les transactions mixtes
- ✅ Gérer les permissions par rôle utilisateur
- ✅ Enregistrer un audit trail complet

### Ce que le système garantit

- ✅ Aucune transaction validée n'est jamais modifiée directement
- ✅ Les soldes sont toujours cohérents (atomicité garantie)
- ✅ La comptabilité est équilibrée (débits = crédits)
- ✅ Le taux de change est figé par transaction
- ✅ L'historique complet est conservé
- ✅ Les corrections sont traçables à 100%
- ✅ Un seul taux actif par paire à la fois
- ✅ Les opérations sont sécurisées par rôle

---

## Support

Pour toute question :

1. Consulter ce rapport complet
2. Vérifier les logs d'audit
3. Utiliser les requêtes de diagnostic
4. Contacter l'administrateur système

---

**Fin du rapport**

**Version** : 3.0 (Complète)
**Date** : 24 décembre 2024
**Statut** : Production
**Auteur** : Système de gestion financière Himaya
