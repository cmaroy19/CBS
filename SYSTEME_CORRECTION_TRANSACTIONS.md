# Système de Correction des Transactions

## Vue d'ensemble

Le système de correction permet d'annuler et de corriger toutes les transactions (simples et mixtes) en créant une transaction inverse qui ajuste automatiquement les soldes.

## Types de transactions supportés

### 1. Transactions simples (table `transactions`)
- Dépôts et retraits standard
- Transactions avec un seul service
- Un seul montant dans une seule devise

### 2. Transactions mixtes (table `transaction_headers` + `transaction_lines`)
- Paiements en plusieurs devises (forex)
- Transactions avec plusieurs lignes équilibrées
- Support des débits et crédits multiples

## Fonctionnement de la correction

### Pour les transactions simples

**Fonction utilisée**: `creer_correction_transaction()`

**Processus**:
1. Vérifie que la transaction existe et n'est pas déjà annulée
2. Crée une transaction inverse (depot → retrait ou retrait → depot)
3. Marque la transaction originale comme `annule = true`
4. Enregistre l'utilisateur et la date de correction
5. Les soldes sont automatiquement ajustés par le trigger

**Exemple**:
- Transaction originale: RETRAIT de 100 USD sur Illico Cash
- Transaction de correction: DEPOT de 100 USD sur Illico Cash
- Résultat: Les soldes reviennent à leur état avant la transaction

### Pour les transactions mixtes

**Fonction utilisée**: `creer_correction_transaction_mixte()`

**Processus**:
1. Vérifie que la transaction existe et n'est pas déjà annulée
2. Copie la transaction header avec le statut `validee`
3. Inverse toutes les lignes (debit ↔ credit)
4. Marque la transaction originale comme `statut = 'annulee'`
5. Les soldes sont automatiquement ajustés par le trigger

**Exemple**:
- Transaction originale:
  - DEBIT: 100 USD cash
  - CREDIT: 200,000 CDF cash (taux 2000)

- Transaction de correction:
  - CREDIT: 100 USD cash
  - DEBIT: 200,000 CDF cash (taux 2000)

- Résultat: Les soldes cash USD et CDF reviennent à leur état initial

## Structure de la base de données

### Colonnes de correction communes

Ajoutées aux tables `transactions` et `transaction_headers`:

| Colonne | Type | Description |
|---------|------|-------------|
| `transaction_origine_id` | uuid | Référence à la transaction originale (si c'est une correction) |
| `raison_correction` | text | Raison de la correction saisie par l'utilisateur |
| `corrigee_par` | uuid | ID de l'utilisateur qui a fait la correction |
| `corrigee_le` | timestamptz | Date et heure de la correction |

### Vue unifiée `v_all_transactions`

Combine les deux types de transactions avec le champ `table_source`:
- `'transactions'` pour les transactions simples
- `'transaction_headers'` pour les transactions mixtes

## Mise à jour automatique des soldes

### Pour transactions simples (trigger existant)

**Trigger**: `trigger_update_soldes_on_transaction`
**Table**: `transactions`

Logique:
- **DEPOT**: cash_global ↑, solde_virtuel_service ↓
- **RETRAIT**: cash_global ↓, solde_virtuel_service ↑

### Pour transactions mixtes (nouveau trigger)

**Trigger**: `trigger_update_balances_from_lines`
**Table**: `transaction_lines`

Logique:
- **DEBIT**: solde concerné ↓ (sortie)
- **CREDIT**: solde concerné ↑ (entrée)

Type de portefeuille:
- **cash**: Met à jour `global_balances.cash_*`
- **virtuel**: Met à jour `services.solde_virtuel_*`

## Interface utilisateur

### Bouton de correction

Visible uniquement pour les rôles `administrateur` et `proprietaire`.

États possibles:
- **"Corriger"**: Transaction normale, peut être corrigée
- **"Annulée"**: Transaction déjà annulée
- **"Correction"**: Transaction qui est elle-même une correction

### Modal de correction

Affiche:
1. Avertissement sur l'impact de la correction
2. Détails de la transaction à corriger
3. Champ obligatoire pour la raison de la correction
4. Aperçu de l'action qui sera effectuée

### Historique

Toutes les corrections sont tracées:
- Transaction originale marquée comme annulée
- Transaction de correction liée à l'originale
- Raison enregistrée
- Utilisateur et date enregistrés

## Sécurité

### Permissions requises

- Seuls les `administrateur` et `proprietaire` peuvent corriger
- Les transactions ne peuvent être corrigées qu'une seule fois
- Les corrections ne peuvent pas être modifiées une fois créées

### Audit

Chaque correction crée une entrée dans `audit_logs`:
- Table: `transactions` ou `transaction_headers`
- Operation: `CORRECTION`
- Données: raison, ID de correction, utilisateur

## Limitations actuelles

1. Une transaction ne peut être corrigée qu'une seule fois
2. Les corrections ne peuvent pas être annulées (nécessiterait une nouvelle correction)
3. Les transactions en brouillon ne peuvent pas être corrigées (doivent être validées d'abord)

## Améliorations futures possibles

1. Correction partielle (seulement certaines lignes)
2. Modification de transaction au lieu d'annulation complète
3. Historique visuel des corrections
4. Export des corrections pour audit comptable
5. Notifications automatiques lors de corrections importantes
