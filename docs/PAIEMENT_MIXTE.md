# Système de Paiement Mixte (Multi-Devise)

## Vue d'ensemble

Le système de paiement mixte permet aux caissiers d'effectuer des transactions en combinant deux devises (USD et CDF) lorsqu'ils n'ont pas suffisamment de fonds dans une seule devise.

## Fonctionnement

### Processus de Transaction

1. **Saisie des informations**: Le caissier remplit le formulaire de transaction normalement
2. **Validation des données**: Le système vérifie que toutes les informations sont correctes
3. **Modale de confirmation**: Une modale s'affiche avec deux options:
   - **"Oui, j'ai les fonds"**: Transaction simple dans la devise demandée
   - **"Non, paiement mixte"**: Option pour payer avec deux devises

### Option Paiement Mixte

Lorsque le caissier choisit "Paiement mixte":

1. Le système affiche:
   - Le montant total à payer/recevoir
   - Un champ pour spécifier le montant dans la devise principale
   - Le calcul automatique de l'équivalent dans l'autre devise
   - Le taux de change appliqué

2. Le caissier peut ajuster le montant dans la devise principale
3. Le système recalcule automatiquement l'équivalent dans l'autre devise

### Exemple Concret

**Scénario**: Retrait de 13 USD

**Option 1 - Transaction simple**:
- Le caissier a 13 USD en caisse
- Il choisit "Oui, j'ai les fonds"
- Transaction enregistrée normalement

**Option 2 - Paiement mixte**:
- Le caissier n'a que 10 USD en caisse
- Il choisit "Non, paiement mixte"
- Il indique avoir 10 USD disponibles
- Le système calcule automatiquement l'équivalent de 3 USD en CDF (ex: 7500 CDF si taux = 2500)
- Le client reçoit: 10 USD + 7500 CDF

## Architecture Technique

### Composants Créés

1. **MixedPaymentModal.tsx**
   - Modale interactive pour la confirmation
   - Gestion du calcul automatique
   - Interface utilisateur intuitive

2. **TransactionsForm.tsx (modifié)**
   - Récupération du taux de change actif
   - Affichage de la modale de confirmation
   - Gestion des deux types de transactions (simple/mixte)

### Tables Utilisées

**Transaction Simple** (table `transactions`):
- Enregistrement direct dans la table transactions
- Une seule devise
- Référence auto-générée

**Transaction Mixte** (tables `transaction_headers` + `transaction_lines`):
- En-tête avec référence unique (TRX-YYYYMM-XXXX)
- Plusieurs lignes équilibrées (débits = crédits)
- Support multi-devises
- Validation automatique

### Structure des Lignes (Transaction Mixte)

Les transactions mixtes utilisent 5 lignes pour équilibrer correctement chaque devise.

#### Retrait Mixte (exemple: 17 USD dont 10 USD cash + 7 USD en CDF = 17500 CDF)

**Lignes en USD** (équilibrées: débit 17 = crédit 10 + 7):
```
Ligne 1: Débit Service Virtuel - 17 USD
Ligne 2: Crédit Cash USD - 10 USD
Ligne 3: Crédit Change (sortant) - 7 USD
```

**Lignes en CDF** (équilibrées: débit 17500 = crédit 17500):
```
Ligne 4: Débit Change (entrant) - 17500 CDF
Ligne 5: Crédit Cash CDF - 17500 CDF
```

#### Dépôt Mixte (exemple: 17 USD dont 10 USD cash + 7 USD en CDF = 17500 CDF)

**Lignes en USD** (équilibrées: débit 10 + 7 = crédit 17):
```
Ligne 1: Débit Cash USD - 10 USD
Ligne 2: Débit Change (entrant) - 7 USD
Ligne 3: Crédit Service Virtuel - 17 USD
```

**Lignes en CDF** (équilibrées: débit 17500 = crédit 17500):
```
Ligne 4: Débit Cash CDF - 17500 CDF
Ligne 5: Crédit Change (sortant) - 17500 CDF
```

### Type de Portefeuille "Change"

Les lignes avec `type_portefeuille = 'change'` sont des écritures comptables intermédiaires qui permettent:
1. D'équilibrer chaque devise séparément (débits = crédits)
2. De représenter la conversion entre devises
3. De maintenir la traçabilité de l'opération de change

**Important**: Les lignes de type "change" ne mettent pas à jour directement les soldes. Elles servent uniquement à l'équilibrage comptable des transactions multi-devises.

## Triggers Automatiques

### Trigger: `update_balances_on_validation`

S'exécute automatiquement lorsqu'une transaction multi-lignes est validée.

**Fonctionnement**:
1. Parcourt toutes les lignes de la transaction
2. **Ignore les lignes de type "change"** (utilisées uniquement pour l'équilibrage)
3. Met à jour les soldes selon le type de portefeuille:
   - **Cash**: Met à jour `global_balances`
   - **Virtuel**: Met à jour le service concerné

**Logique**:
- **Débit cash** = Augmentation du cash (entrée d'argent)
- **Crédit cash** = Diminution du cash (sortie d'argent)
- **Débit virtuel** = Diminution du solde virtuel
- **Crédit virtuel** = Augmentation du solde virtuel

**Exemple avec retrait mixte de 17 USD (10 USD + 7 USD en CDF)**:
- Ligne 1 (Débit virtuel 17 USD): Solde virtuel service -17 USD
- Ligne 2 (Crédit cash 10 USD): Cash USD -10 USD
- Ligne 3 (Crédit change 7 USD): **Ignorée** (pas de mise à jour)
- Ligne 4 (Débit change 17500 CDF): **Ignorée** (pas de mise à jour)
- Ligne 5 (Crédit cash 17500 CDF): Cash CDF -17500 CDF

**Résultat final**:
- Solde virtuel service: -17 USD
- Cash USD: -10 USD
- Cash CDF: -17500 CDF

## Avantages du Système

1. **Flexibilité**: Permet de servir les clients même avec des fonds limités
2. **Traçabilité**: Toutes les transactions mixtes sont enregistrées en détail
3. **Équilibre**: Le système garantit l'équilibre comptable (débits = crédits)
4. **Automatisation**: Calculs et mises à jour automatiques
5. **Sécurité**: Validation avant toute opération

## Taux de Change

Le système utilise le taux de change actif configuré dans la table `exchange_rates`:
- Un seul taux actif par paire de devises
- Utilisé pour tous les calculs automatiques
- Figé dans la transaction pour traçabilité

## Migrations Base de Données

**Migration 1**: `20251221_add_multi_line_transaction_triggers.sql`
- Création de la fonction `update_balances_on_validation()`
- Création du trigger sur `transaction_headers`
- Gestion automatique des soldes

**Migration 2**: `20251221_update_trigger_handle_change_portfolio.sql`
- Mise à jour de la fonction pour ignorer les lignes de type "change"
- Gestion correcte des transactions multi-devises équilibrées

## Notes Importantes

1. Le taux de change doit être configuré avant d'utiliser le paiement mixte
2. Les transactions mixtes sont validées immédiatement (pas de brouillon)
3. Le système vérifie l'équilibre des lignes avant validation
4. Les soldes sont mis à jour atomiquement lors de la validation
