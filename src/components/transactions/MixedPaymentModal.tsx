import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface MixedPaymentModalProps {
  montantTotal: number;
  devise: 'USD' | 'CDF';
  type: 'depot' | 'retrait';
  tauxChange: number;
  onConfirm: (useMixed: boolean, montantPrincipal?: number, montantSecondaire?: number) => void;
  onCancel: () => void;
}

export function MixedPaymentModal({
  montantTotal,
  devise,
  type,
  tauxChange,
  onConfirm,
  onCancel,
}: MixedPaymentModalProps) {
  const [hasFunds, setHasFunds] = useState<boolean | null>(null);
  const [montantPrincipal, setMontantPrincipal] = useState(montantTotal);
  const [montantSecondaire, setMontantSecondaire] = useState(0);

  const deviseSecondaire = devise === 'USD' ? 'CDF' : 'USD';
  const actionText = type === 'depot' ? 'recevoir du client' : 'donner au client';

  // Calculer l'équivalent dans l'autre devise
  useEffect(() => {
    const montantRestant = montantTotal - montantPrincipal;
    if (montantRestant > 0) {
      if (devise === 'USD') {
        // Montant restant en USD -> convertir en CDF
        setMontantSecondaire(montantRestant * tauxChange);
      } else {
        // Montant restant en CDF -> convertir en USD
        setMontantSecondaire(montantRestant / tauxChange);
      }
    } else {
      setMontantSecondaire(0);
    }
  }, [montantPrincipal, montantTotal, devise, tauxChange]);

  const handleConfirm = () => {
    if (hasFunds) {
      // Paiement simple dans la devise demandée
      onConfirm(false);
    } else {
      // Paiement mixte
      if (montantPrincipal < 0 || montantPrincipal > montantTotal) {
        alert('Le montant en ' + devise + ' doit être entre 0 et ' + montantTotal);
        return;
      }
      onConfirm(true, montantPrincipal, montantSecondaire);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-900">
            Confirmation de {type === 'depot' ? 'dépôt' : 'retrait'}
          </h3>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Montant total */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Montant total de l'opération</p>
            <p className="text-2xl font-bold text-slate-900">
              {montantTotal.toFixed(2)} {devise}
            </p>
          </div>

          {/* Question principale */}
          {hasFunds === null && (
            <div className="space-y-4">
              <p className="text-slate-700 font-medium">
                Avez-vous {montantTotal.toFixed(2)} {devise} disponibles à {actionText} ?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setHasFunds(true)}
                  className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                >
                  Oui, j'ai les fonds
                </button>
                <button
                  onClick={() => setHasFunds(false)}
                  className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  Non, paiement mixte
                </button>
              </div>
            </div>
          )}

          {/* Configuration paiement mixte */}
          {hasFunds === false && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  Paiement mixte activé
                </p>
                <p className="text-xs text-blue-600">
                  Taux de change: 1 USD = {tauxChange.toFixed(2)} CDF
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Montant en {devise}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={montantTotal}
                    value={montantPrincipal}
                    onChange={(e) => setMontantPrincipal(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center justify-center">
                  <div className="text-slate-400 text-sm font-medium">+</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Équivalent en {deviseSecondaire}
                  </label>
                  <input
                    type="text"
                    value={montantSecondaire.toFixed(2)}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-600 mb-2">Récapitulatif du paiement mixte:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-700">En {devise}:</span>
                    <span className="font-medium">{montantPrincipal.toFixed(2)} {devise}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700">En {deviseSecondaire}:</span>
                    <span className="font-medium">{montantSecondaire.toFixed(2)} {deviseSecondaire}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-1 mt-1">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-900">Total:</span>
                      <span className="text-emerald-600">{montantTotal.toFixed(2)} {devise}</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setHasFunds(null)}
                className="text-sm text-slate-600 hover:text-slate-800 underline"
              >
                Retour
              </button>
            </div>
          )}

          {/* Message si fonds disponibles */}
          {hasFunds === true && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-800">
                  Transaction simple de {montantTotal.toFixed(2)} {devise}
                </p>
              </div>

              <button
                onClick={() => setHasFunds(null)}
                className="text-sm text-slate-600 hover:text-slate-800 underline"
              >
                Retour
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        {hasFunds !== null && (
          <div className="flex space-x-3 p-6 border-t border-slate-200">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              Valider l'opération
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
