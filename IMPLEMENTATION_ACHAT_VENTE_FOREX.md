# Implémentation du Système Achat/Vente Forex

## Résumé

Modification ciblée du formulaire de transaction mixte (Forex) pour appliquer correctement la logique achat/vente des devises USD/CDF basée sur la devise qui sort physiquement de la caisse.

## Fichier Modifié

**src/components/transactions/TransactionMixteForm.tsx**

## Modifications Apportées

### 1. Ajout de l'État du Contexte du Taux

Trois nouvelles variables d'état ont été ajoutées pour gérer le contexte du taux de change :

```typescript
const [exchangeRateContext, setExchangeRateContext] = useState<'BUY_USD' | 'SELL_USD'>('SELL_USD');
const [exchangeRateValue, setExchangeRateValue] = useState<number>(0);
const [exchangeRateLabel, setExchangeRateLabel] = useState<string>('');
```

### 2. Logique Automatique de Détermination du Taux

Une nouvelle fonction `determineExchangeRateContext()` a été créée qui :

- Observe les montants saisis en USD et CDF
- Détermine automatiquement quelle devise sort de la caisse
- Charge le taux de change approprié depuis la base de données
- Met à jour le contexte (ACHAT ou VENTE) et le libellé

**Règles implémentées :**

```typescript
if (formData.montant_cdf > 0) {
  // La caisse donne des CDF au client
  // → Taux USD → CDF (VENTE USD)
  deviseSource = 'USD';
  deviseDestination = 'CDF';
  context = 'SELL_USD';
  label = 'Taux de VENTE USD';
}
else if (formData.montant_usd > 0) {
  // La caisse donne des USD au client
  // → Taux CDF → USD (ACHAT USD)
  deviseSource = 'CDF';
  deviseDestination = 'USD';
  context = 'BUY_USD';
  label = 'Taux d\'ACHAT USD';
}
```

### 3. Affichage Amélioré du Taux

Le bloc d'affichage du taux de change a été complètement redessiné pour montrer :

- **Titre clair :** "Taux de change appliqué"
- **Contexte explicite :** "Taux de VENTE USD" ou "Taux d'ACHAT USD"
- **Badge visuel :** Couleur distinctive (amber pour VENTE, bleu pour ACHAT)
- **Taux en format USD → CDF :** Toujours affiché comme "1 USD = X CDF"
- **Indication de flux :** "La caisse donne des CDF/USD au client"

### 4. Calcul Automatique Mis à Jour

Le calcul automatique utilise maintenant `exchangeRateValue` au lieu de `exchangeRate.taux` :

```typescript
// Pour devise_reference USD
const montantCdfCalcule = resteUsd * exchangeRateValue;

// Pour devise_reference CDF
const montantUsdCalcule = resteCdf / exchangeRateValue;
```

### 5. Fonction calculerEquivalent() Améliorée

La fonction retourne maintenant le contexte du taux pour l'affichage :

```typescript
return {
  // ... autres champs
  tauxLabel: exchangeRateLabel  // Nouveau champ
};
```

### 6. Validation Mise à Jour

La validation des montants utilise maintenant `exchangeRateValue` pour garantir la cohérence :

```typescript
const montantCdfAttendu = resteUsd * exchangeRateValue;
const montantUsdAttendu = resteCdf / exchangeRateValue;
```

### 7. Audit Log Enrichi

L'audit log enregistre maintenant le contexte complet du taux :

```typescript
new_data: {
  // ... autres champs
  taux: exchangeRateValue,
  taux_contexte: exchangeRateContext,
  taux_label: exchangeRateLabel,
}
```

## Comportement du Système

### Scénario 1 : Transaction en USD avec paiement mixte

1. **Utilisateur saisit :**
   - Type : Retrait
   - Devise de référence : USD
   - Montant total : 100 USD
   - Montant payé en USD : 50 USD

2. **Système détecte :**
   - `montant_usd > 0` → La caisse donne des USD
   - **Taux appliqué :** CDF → USD (ACHAT USD)

3. **Affichage :**
   - "Taux d'ACHAT USD"
   - Badge bleu "Achat USD"
   - "1 USD = 2500 CDF" (par exemple)
   - "La caisse donne des USD au client"

### Scénario 2 : Transaction en USD avec paiement en CDF

1. **Utilisateur saisit :**
   - Type : Retrait
   - Devise de référence : USD
   - Montant total : 100 USD
   - Montant payé en USD : 0 USD
   - (Le système calcule automatiquement le montant en CDF)

2. **Système détecte :**
   - `montant_cdf > 0` → La caisse donne des CDF
   - **Taux appliqué :** USD → CDF (VENTE USD)

3. **Affichage :**
   - "Taux de VENTE USD"
   - Badge amber "Vente USD"
   - "1 USD = 2300 CDF" (par exemple)
   - "La caisse donne des CDF au client"

## Avantages de Cette Implémentation

### 1. Automatique et Transparent
- Le taux correct est sélectionné automatiquement
- L'utilisateur voit clairement quel taux est appliqué
- Aucune intervention manuelle nécessaire

### 2. Précis et Sûr
- La logique est basée sur la devise qui sort physiquement
- Validation rigoureuse des montants calculés
- Enregistrement complet dans l'audit log

### 3. Visuel et Pédagogique
- Badge de couleur pour identifier rapidement le contexte
- Libellé explicite (ACHAT vs VENTE)
- Indication claire du flux monétaire

### 4. Non Invasif
- Aucune modification de la structure des transactions
- Aucun impact sur la logique comptable existante
- Aucun nouveau champ obligatoire pour l'utilisateur
- Les autres types de transactions ne sont pas affectés

## Structure de la Base de Données

Le système utilise la table existante `exchange_rates` avec support bidirectionnel :

```sql
-- Taux de VENTE USD (la caisse vend CDF et achète USD)
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif)
VALUES ('USD', 'CDF', 2300, true);

-- Taux d'ACHAT USD (la caisse achète CDF et vend USD)
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif)
VALUES ('CDF', 'USD', 0.0004, true);  -- Équivalent à 1 USD = 2500 CDF
```

## Tests Recommandés

### Test 1 : Retrait USD avec paiement en USD
- Vérifier que le taux d'ACHAT USD est affiché
- Vérifier que le badge est bleu

### Test 2 : Retrait USD avec paiement en CDF
- Vérifier que le taux de VENTE USD est affiché
- Vérifier que le badge est amber

### Test 3 : Retrait USD avec paiement mixte (USD + CDF)
- Si `montant_usd > 0` en premier, doit afficher ACHAT USD
- Si `montant_cdf > 0` en premier, doit afficher VENTE USD

### Test 4 : Dépôt avec montants mixtes
- Même logique que le retrait
- Vérifier que les calculs sont corrects

### Test 5 : Changement dynamique
- Modifier les montants
- Vérifier que le taux change automatiquement selon la devise saisie

## Maintenance

### Pour modifier les taux :
Utiliser le module "Taux de change" pour créer/modifier les taux actifs.

### Pour changer la logique :
Modifier la fonction `determineExchangeRateContext()` dans `TransactionMixteForm.tsx`.

### Pour ajuster l'affichage :
Modifier la section JSX du bloc "Taux de change appliqué" (lignes 292-333).

## Notes Importantes

1. **Pas de taux manuel :** Les utilisateurs ne peuvent pas saisir de taux personnalisé
2. **Taux bidirectionnels requis :** Les deux sens (USD→CDF et CDF→USD) doivent être configurés
3. **Compatibilité :** Le système reste compatible avec les anciennes transactions
4. **Performance :** Aucun impact sur la vitesse de chargement ou de soumission

## Date de Mise en Production

26 janvier 2026

## Auteur

Système de gestion financière - Module Forex
