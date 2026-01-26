# Guide Utilisateur : Transactions Mixtes Forex

## Introduction

Le formulaire de transaction mixte (Forex) a été amélioré pour afficher automatiquement le type de taux de change appliqué selon la situation.

## Qu'est-ce qui a changé ?

### Avant
- Un seul taux affiché : "Taux actif: 1 USD = X CDF"
- Pas d'indication si c'est un taux d'achat ou de vente

### Maintenant
- **Affichage clair du contexte :** "Taux de VENTE USD" ou "Taux d'ACHAT USD"
- **Badge de couleur :** Amber (orange) pour la vente, Bleu pour l'achat
- **Explication :** Indication de quelle devise sort de la caisse

## Comment ça fonctionne ?

### Règle Simple

**Le taux affiché dépend de la devise que vous donnez au client :**

| Si la caisse donne | Taux appliqué | Badge affiché |
|-------------------|---------------|---------------|
| Des **CDF** au client | Taux de VENTE USD | 🟠 Amber |
| Des **USD** au client | Taux d'ACHAT USD | 🔵 Bleu |

## Exemples Pratiques

### Exemple 1 : Retrait 100 USD - Client reçoit tout en CDF

**Saisie :**
- Type : Retrait
- Devise de référence : USD
- Montant total : 100 USD
- Montant payé en USD : 0 USD
- Montant payé en CDF : (calculé automatiquement)

**Résultat :**
```
┌─────────────────────────────────────────┐
│ Taux de change appliqué                 │
│                                         │
│ TAUX DE VENTE USD         🟠 Vente USD │
│ 1 USD = 2,300.00 CDF                   │
│ La caisse donne des CDF au client      │
└─────────────────────────────────────────┘
```

### Exemple 2 : Retrait 100 USD - Client reçoit 50 USD + reste en CDF

**Saisie :**
- Type : Retrait
- Devise de référence : USD
- Montant total : 100 USD
- Montant payé en USD : 50 USD
- Montant payé en CDF : (calculé automatiquement)

**Résultat :**
```
┌─────────────────────────────────────────┐
│ Taux de change appliqué                 │
│                                         │
│ TAUX D'ACHAT USD          🔵 Achat USD │
│ 1 USD = 2,500.00 CDF                   │
│ La caisse donne des USD au client      │
└─────────────────────────────────────────┘
```

### Exemple 3 : Retrait 100 USD - Client reçoit tout en USD

**Saisie :**
- Type : Retrait
- Devise de référence : USD
- Montant total : 100 USD
- Montant payé en USD : 100 USD
- Montant payé en CDF : 0 CDF

**Résultat :**
```
┌─────────────────────────────────────────┐
│ Taux de change appliqué                 │
│                                         │
│ TAUX D'ACHAT USD          🔵 Achat USD │
│ 1 USD = 2,500.00 CDF                   │
│ La caisse donne des USD au client      │
└─────────────────────────────────────────┘
```

## Comprendre les Taux

### Taux de VENTE USD (Badge 🟠 Amber)

**Signification :** Vous vendez des francs congolais (CDF) contre des dollars (USD)

**Quand apparaît-il ?**
- Quand la caisse donne des CDF au client
- Le montant en CDF est supérieur à 0

**Exemple :**
- Taux : 1 USD = 2,300 CDF
- Pour 100 USD, vous donnez 230,000 CDF

### Taux d'ACHAT USD (Badge 🔵 Bleu)

**Signification :** Vous achetez des francs congolais (CDF) avec des dollars (USD)

**Quand apparaît-il ?**
- Quand la caisse donne des USD au client
- Le montant en USD est supérieur à 0

**Exemple :**
- Taux : 1 USD = 2,500 CDF
- Pour recevoir 100 USD, le client doit donner 250,000 CDF

## Changement Automatique du Taux

Le système détecte automatiquement quelle devise vous utilisez et change le taux en temps réel :

```
Étape 1 : Vous saisissez 50 USD dans "Montant payé en USD"
         → Le système affiche le taux d'ACHAT USD (🔵)

Étape 2 : Vous changez d'avis et mettez 0 USD
         → Le système affiche maintenant le taux de VENTE USD (🟠)
```

## Points Importants

### ✅ Ce que vous devez savoir

1. **Aucune saisie manuelle :** Le taux est toujours chargé depuis la configuration
2. **Changement dynamique :** Le taux change automatiquement selon vos saisies
3. **Deux taux distincts :** L'achat et la vente ont des taux différents
4. **Validation stricte :** Le système vérifie que les montants sont corrects

### ❌ Erreurs Possibles

**"Aucun taux de change actif configuré"**
- Solution : Demandez à un gérant de configurer les taux dans le module Taux de change

**"Montant CDF incorrect"**
- Le calcul automatique a été désactivé et le montant saisi ne correspond pas au taux
- Solution : Réactivez le "Calcul auto" ou corrigez le montant

## Cas d'Usage Courants

### Cas 1 : Client avec Compte Virtuel USD

Un client a 500 USD sur son compte virtuel et veut retirer :
- Option A : Tout en CDF → Utilise le taux de VENTE USD
- Option B : 200 USD en cash + reste en CDF → Utilise le taux d'ACHAT USD
- Option C : Tout en USD → Utilise le taux d'ACHAT USD

### Cas 2 : Client qui Dépose

Un client dépose de l'argent :
- Dépôt en CDF → Le système crédite en USD au taux d'ACHAT USD
- Dépôt en USD → Le système crédite directement en USD
- Dépôt mixte → Utilise le taux correspondant à la devise reçue

## Vérification Visuelle

Avant de valider une transaction, vérifiez :

1. **Le badge de couleur** correspond à la devise que vous donnez :
   - 🟠 Amber = Vous donnez des CDF
   - 🔵 Bleu = Vous donnez des USD

2. **Le montant calculé** semble correct

3. **Le détail du paiement** affiche le bon taux

## Configuration des Taux

Pour configurer ou modifier les taux (Gérants uniquement) :

1. Allez dans **Taux de change** dans le menu
2. Créez deux taux distincts :
   - **USD → CDF** : Taux de vente USD (ex: 2,300)
   - **CDF → USD** : Taux d'achat USD (ex: 0.0004 soit 1 USD = 2,500 CDF)
3. Activez les deux taux
4. Retournez aux Transactions, les nouveaux taux s'affichent automatiquement

## Questions Fréquentes

**Q : Pourquoi deux taux différents ?**
R : C'est normal dans le change de devises. Le taux d'achat est généralement plus élevé que le taux de vente pour générer une marge commerciale.

**Q : Puis-je saisir un taux manuellement ?**
R : Non, les taux sont toujours chargés depuis la configuration pour garantir la cohérence.

**Q : Le taux change pendant que je saisis ?**
R : Oui, c'est normal. Le système détecte quelle devise sort de la caisse et ajuste automatiquement.

**Q : Que se passe-t-il si je modifie le montant en CDF manuellement ?**
R : Le calcul automatique se désactive. Vous devez vous assurer que le montant correspond au taux affiché.

**Q : Les anciennes transactions sont-elles affectées ?**
R : Non, seules les nouvelles transactions utilisent ce système. Les anciennes restent inchangées.

## Support

En cas de problème, notez :
- Le type de transaction (Dépôt/Retrait)
- La devise de référence
- Les montants saisis
- Le taux affiché
- Le message d'erreur (si applicable)

Et contactez votre administrateur système.

---

**Version :** 1.0
**Date :** 26 janvier 2026
**Module :** Transactions Mixtes (Forex)
