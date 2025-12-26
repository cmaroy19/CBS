# Nettoyage de la Base de Données

Ce document contient la requête SQL pour vider la base de données tout en conservant les services et les utilisateurs.

## Données Supprimées

- ✅ Toutes les transactions (transaction_headers, transaction_lines, transactions)
- ✅ Tous les approvisionnements
- ✅ Toutes les opérations de change
- ✅ Tous les taux de change (exchange_rates)
- ✅ Toutes les commissions quotidiennes
- ✅ Toutes les clôtures de service quotidiennes
- ✅ Logs d'audit

## Données Conservées

- ✅ Services (avec remise à zéro des soldes)
- ✅ Utilisateurs (users)
- ✅ Global balances (avec remise à zéro)
- ✅ Structure complète de la base (tables, vues, fonctions, triggers)

## Requête SQL

```sql
-- Désactiver temporairement les triggers pour éviter les problèmes de cascade
SET session_replication_role = replica;

-- Supprimer toutes les lignes de transactions
DELETE FROM transaction_lines;

-- Supprimer tous les en-têtes de transactions
DELETE FROM transaction_headers;

-- Supprimer toutes les anciennes transactions (si elles existent encore)
DELETE FROM transactions;

-- Supprimer tous les approvisionnements
DELETE FROM approvisionnements;

-- Supprimer toutes les opérations de change
DELETE FROM change_operations;

-- Supprimer tous les taux de change
DELETE FROM exchange_rates;

-- Supprimer toutes les commissions quotidiennes
DELETE FROM commissions_journalieres;

-- Supprimer toutes les clôtures de service
DELETE FROM clotures_journalieres;

-- Supprimer les logs d'audit
DELETE FROM audit_logs;

-- Remettre à zéro tous les soldes virtuels des services
UPDATE services
SET
  solde_virtuel_usd = 0,
  solde_virtuel_cdf = 0
WHERE id IS NOT NULL;

-- Remettre à zéro les soldes globaux de cash
UPDATE global_balances
SET
  cash_usd = 0,
  cash_cdf = 0,
  updated_at = now()
WHERE id IS NOT NULL;

-- Réactiver les triggers
SET session_replication_role = DEFAULT;
```

## Utilisation

### Option 1: Via Supabase Dashboard

1. Connectez-vous à votre projet Supabase
2. Allez dans "SQL Editor"
3. Copiez-collez la requête ci-dessus
4. Exécutez la requête

### Option 2: Via Migration

Créez un fichier de migration avec le contenu ci-dessus et appliquez-le via votre outil de migration préféré.

## Notes Importantes

- Cette opération est **irréversible**
- Assurez-vous d'avoir une sauvegarde avant d'exécuter cette requête
- Tous les soldes (cash et virtuels) seront remis à zéro
- Les services et utilisateurs resteront intacts
