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

#### Retrait Mixte (exemple: 13 USD dont 10 USD cash + 3 USD en CDF)

```
Ligne 1: Débit Service Virtuel - 13 USD
Ligne 2: Crédit Cash USD - 10 USD
Ligne 3: Crédit Cash CDF - 7500 CDF (équiv. 3 USD)
```

#### Dépôt Mixte (exemple: 13 USD dont 10 USD cash + 3 USD en CDF)

```
Ligne 1: Débit Cash USD - 10 USD
Ligne 2: Débit Cash CDF - 7500 CDF (équiv. 3 USD)
Ligne 3: Crédit Service Virtuel - 13 USD
```

## Triggers Automatiques

### Trigger: `update_balances_on_validation`

S'exécute automatiquement lorsqu'une transaction multi-lignes est validée.

**Fonctionnement**:
1. Parcourt toutes les lignes de la transaction
2. Met à jour les soldes selon le type de portefeuille:
   - **Cash**: Met à jour `global_balances`
   - **Virtuel**: Met à jour le service concerné

**Logique**:
- **Débit cash** = Augmentation du cash (entrée d'argent)
- **Crédit cash** = Diminution du cash (sortie d'argent)
- **Débit virtuel** = Diminution du solde virtuel
- **Crédit virtuel** = Augmentation du solde virtuel

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

## Migration Base de Données

**Migration**: `20251221_add_multi_line_transaction_triggers.sql`

Cette migration crée:
- La fonction `update_balances_on_validation()`
- Le trigger sur `transaction_headers`
- La gestion automatique des soldes

## Notes Importantes

1. Le taux de change doit être configuré avant d'utiliser le paiement mixte
2. Les transactions mixtes sont validées immédiatement (pas de brouillon)
3. Le système vérifie l'équilibre des lignes avant validation
4. Les soldes sont mis à jour atomiquement lors de la validation
