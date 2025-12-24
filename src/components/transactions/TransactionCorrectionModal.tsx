import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Transaction } from '../../types';

interface TransactionCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSuccess: () => void;
}

export function TransactionCorrectionModal({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}: TransactionCorrectionModalProps) {
  const { user } = useAuthStore();
  const [raison, setRaison] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!transaction) return null;

  if (transaction.table_source === 'transaction_headers') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Correction non disponible" size="lg">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 mb-1">
                Cette transaction ne peut pas être corrigée
              </h4>
              <p className="text-sm text-amber-800">
                Les transactions de type paiement mixte ne peuvent pas être corrigées pour le moment.
                Cette fonctionnalité sera disponible dans une prochaine version.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!raison.trim()) {
        throw new Error('Veuillez indiquer la raison de la correction');
      }

      const { data, error: rpcError } = await supabase.rpc('creer_correction_transaction', {
        p_transaction_id: transaction.id,
        p_raison: raison.trim(),
        p_user_id: user?.id,
      });

      if (rpcError) throw rpcError;

      await supabase.from('audit_logs').insert({
        table_name: 'transactions',
        operation: 'CORRECTION',
        record_id: transaction.id,
        new_data: {
          raison: raison,
          correction_id: data.correction_id,
        },
        user_id: user?.id,
      });

      setRaison('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la correction de la transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setRaison('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Corriger une transaction" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-900 mb-1">Attention</h4>
            <p className="text-sm text-amber-800">
              Cette action va créer une transaction d'annulation et marquer la transaction
              originale comme annulée. Les soldes seront automatiquement ajustés.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">
            Détails de la transaction à corriger
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-600">Type :</span>
              <span className="ml-2 font-medium text-slate-900">
                {transaction.type === 'depot' ? 'Dépôt' : 'Retrait'}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Service :</span>
              <span className="ml-2 font-medium text-slate-900">
                {transaction.service?.nom || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Montant :</span>
              <span className="ml-2 font-medium text-slate-900">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(transaction.montant)}{' '}
                {transaction.devise}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Référence :</span>
              <span className="ml-2 font-mono text-xs bg-slate-200 px-2 py-1 rounded">
                {transaction.reference}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-600">Date :</span>
              <span className="ml-2 font-medium text-slate-900">
                {new Date(transaction.created_at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {transaction.info_client && (
              <div className="col-span-2">
                <span className="text-slate-600">Client :</span>
                <span className="ml-2 font-medium text-slate-900">
                  {transaction.info_client}
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Raison de la correction <span className="text-red-500">*</span>
          </label>
          <textarea
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            rows={4}
            placeholder="Expliquez pourquoi cette transaction doit être corrigée..."
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            Cette raison sera enregistrée dans l'historique des corrections.
          </p>
        </div>

        <div className="bg-slate-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-2">
            Action qui sera effectuée
          </h4>
          <ul className="text-sm text-slate-700 space-y-1">
            <li className="flex items-start">
              <span className="text-emerald-600 mr-2">•</span>
              <span>
                Création d'une transaction de{' '}
                <strong>{transaction.type === 'depot' ? 'retrait' : 'dépôt'}</strong> de{' '}
                <strong>
                  {new Intl.NumberFormat('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(transaction.montant)}{' '}
                  {transaction.devise}
                </strong>
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-emerald-600 mr-2">•</span>
              <span>La transaction originale sera marquée comme annulée</span>
            </li>
            <li className="flex items-start">
              <span className="text-emerald-600 mr-2">•</span>
              <span>Les soldes seront ajustés automatiquement</span>
            </li>
            <li className="flex items-start">
              <span className="text-emerald-600 mr-2">•</span>
              <span>L'historique complet sera conservé</span>
            </li>
          </ul>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || !raison.trim()}
            className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Correction en cours...' : 'Confirmer la correction'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
