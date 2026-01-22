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
   - Taux : **0.000444444** (1/2250)
   - Actif : **Coché**
   - Notes : "Taux de vente USD - Achat CDF (1 USD = 2250 CDF)"
3. Cliquer sur **Créer**

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

---

## 6. Exemples pratiques

### 6.1 Configuration avec marge commerciale

**Objectif :** Marge de 2% sur les opérations de change

**Calcul :**
- Taux de marché : 2200 CDF/USD
- Marge souhaitée : 2%
- Taux d'achat USD : 2200 (on achète l'USD du client)
- Taux de vente USD : 2200 × 1.02 = 2244 (on vend l'USD au client)

**Configuration :**
```sql
-- Taux d'achat USD (client vend USD)
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
VALUES ('USD', 'CDF', 2200, true, 'Taux achat USD - Marge 2%');

-- Taux de vente USD (client achète USD)
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
VALUES ('CDF', 'USD', 1/2244, true, 'Taux vente USD - Marge 2%');
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
