# Guide de Nettoyage de la Base de Données

## Vue d'ensemble

Ce document explique comment vider la base de données pour supprimer toutes les transactions, approvisionnements et taux de change tout en préservant les utilisateurs et les services.

## ⚠️ AVERTISSEMENT

**CETTE OPÉRATION EST IRREVERSIBLE !**

Une fois exécutée, toutes les données suivantes seront **DÉFINITIVEMENT SUPPRIMÉES** :
- Toutes les transactions
- Tous les approvisionnements
- Tous les taux de change
- Toutes les corrections de transactions
- Toutes les clôtures journalières
- Toutes les commissions journalières
- Les soldes des services seront réinitialisés à 0

## Données Préservées

Les données suivantes seront **CONSERVÉES** :
- Utilisateurs (comptes et mots de passe)
- Services mobiles money (Vodacom, Airtel, Orange, Africell)
- Structure de la base de données (tables, triggers, fonctions)

## Requête SQL de Nettoyage

```sql
-- Désactiver temporairement les triggers
SET session_replication_role = 'replica';

-- 1. Supprimer toutes les lignes de transactions
DELETE FROM transaction_lines;

-- 2. Supprimer tous les en-têtes de transactions
DELETE FROM transaction_headers;

-- 3. Supprimer toutes les transactions simples (ancienne table)
DELETE FROM transactions;

-- 4. Supprimer tous les approvisionnements
DELETE FROM approvisionnements;

-- 5. Supprimer tous les taux de change
DELETE FROM exchange_rates;

-- 6. Supprimer toutes les clôtures journalières
DELETE FROM clotures_journalieres;

-- 7. Supprimer toutes les commissions journalières
DELETE FROM commissions_journalieres;

-- 8. Supprimer toutes les opérations de change
DELETE FROM change_operations;

-- 9. Supprimer tous les logs d'audit
DELETE FROM audit_logs;

-- 10. Réinitialiser les soldes des services à 0
UPDATE services
SET
  solde_virtuel_usd = 0,
  solde_virtuel_cdf = 0,
  updated_at = now();

-- 11. Réinitialiser les soldes cash globaux à 0
UPDATE global_balances
SET
  cash_usd = 0,
  cash_cdf = 0,
  updated_at = now();

-- Réactiver les triggers
SET session_replication_role = 'origin';
```

## Comment Utiliser

### Option 1 : Migration automatique (DÉJÀ APPLIQUÉE)

La migration `20260128_clean_database_transactions_approvisionnements_taux.sql` a été créée et **appliquée automatiquement**.

La base de données a déjà été nettoyée. Vous n'avez rien à faire !

### Option 2 : Manuellement via SQL Editor

1. Connectez-vous à votre tableau de bord Supabase
2. Allez dans **SQL Editor**
3. Copiez et collez la requête SQL ci-dessus
4. Cliquez sur **Run** pour exécuter

### Option 3 : Via Supabase CLI (si installé)

```bash
supabase db execute < chemin/vers/migration.sql
```

## Tables Affectées

| Table | Action | Impact |
|-------|--------|--------|
| `transaction_lines` | DELETE | Toutes les lignes de transaction supprimées |
| `transaction_headers` | DELETE | Tous les en-têtes de transaction supprimés |
| `transactions` | DELETE | Toutes les transactions anciennes supprimées |
| `approvisionnements` | DELETE | Tous les approvisionnements supprimés |
| `exchange_rates` | DELETE | Tous les taux de change supprimés |
| `clotures_journalieres` | DELETE | Toutes les clôtures journalières supprimées |
| `commissions_journalieres` | DELETE | Toutes les commissions journalières supprimées |
| `change_operations` | DELETE | Toutes les opérations de change supprimées |
| `audit_logs` | DELETE | Tous les logs d'audit supprimés |
| `services` | UPDATE | Soldes virtuels réinitialisés à 0 |
| `global_balances` | UPDATE | Soldes cash globaux réinitialisés à 0 |

## Ordre d'Exécution

L'ordre des suppressions est important pour respecter les contraintes de clés étrangères :

1. **Lignes de transactions** (dépendent des en-têtes)
2. **En-têtes de transactions** (peuvent référencer d'autres en-têtes pour corrections)
3. **Transactions simples** (ancienne table)
4. **Approvisionnements**
5. **Taux de change**
6. **Clôtures journalières**
7. **Commissions journalières**
8. **Opérations de change**
9. **Logs d'audit**
10. **Réinitialisation des soldes des services**
11. **Réinitialisation des soldes cash globaux**

## Vérification Post-Nettoyage

Après l'exécution, vous pouvez vérifier que les tables sont vides :

```sql
-- Vérifier le nombre de lignes restantes
SELECT
  (SELECT COUNT(*) FROM transaction_lines) as lignes_transactions,
  (SELECT COUNT(*) FROM transaction_headers) as entetes_transactions,
  (SELECT COUNT(*) FROM transactions) as anciennes_transactions,
  (SELECT COUNT(*) FROM approvisionnements) as approvisionnements,
  (SELECT COUNT(*) FROM exchange_rates) as taux_change,
  (SELECT COUNT(*) FROM clotures_journalieres) as clotures,
  (SELECT COUNT(*) FROM commissions_journalieres) as commissions,
  (SELECT COUNT(*) FROM change_operations) as operations_change,
  (SELECT COUNT(*) FROM audit_logs) as audit_logs;

-- Vérifier les soldes des services (doivent être à 0)
SELECT
  nom as nom_service,
  solde_virtuel_usd,
  solde_virtuel_cdf
FROM services;

-- Vérifier les soldes cash globaux (doivent être à 0)
SELECT
  cash_usd,
  cash_cdf,
  updated_at
FROM global_balances;
```

## Redémarrage du Système

Après le nettoyage, vous devrez :

1. **Configurer les taux de change** dans la page "Taux de Change"
2. **Approvisionner les services** si nécessaire
3. **Vérifier les soldes** dans le dashboard

## Support

Pour toute question ou problème, contactez l'administrateur système.

---

**Date de création :** 2026-01-28
**Version :** 1.0
