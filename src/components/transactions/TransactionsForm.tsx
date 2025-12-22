import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Service } from '../../types';

interface TransactionsFormProps {
  services: Service[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransactionsForm({ services, onSuccess, onCancel }: TransactionsFormProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    type: 'depot' as 'depot' | 'retrait',
    service_id: '',
    montant: 0,
    devise: 'USD' as 'USD' | 'CDF',
    reference_manuelle: '',
    info_client: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const service = services.find((s) => s.id === formData.service_id);
      if (!service) {
        throw new Error('Service non trouvé');
      }

      if (formData.montant <= 0) {
        throw new Error('Le montant doit être supérieur à zéro');
      }

      if (formData.reference_manuelle.trim()) {
        const { data: existingTransaction } = await supabase
          .from('transactions')
          .select('id')
          .eq('reference', formData.reference_manuelle.trim())
          .maybeSingle();

        if (existingTransaction) {
          throw new Error('Cette référence existe déjà. Veuillez en choisir une autre.');
        }
      }

      const soldeKey = formData.devise === 'USD' ? 'solde_virtuel_usd' : 'solde_virtuel_cdf';

      if (formData.type === 'depot') {
        if (service[soldeKey] < formData.montant) {
          throw new Error(
            `Solde virtuel insuffisant. Solde disponible: ${service[soldeKey].toFixed(2)} ${formData.devise}`
          );
        }
      } else {
        const { data: globalBalance } = await supabase
          .from('global_balances')
          .select('*')
          .maybeSingle();

        if (!globalBalance) {
          throw new Error('Balance globale non trouvée');
        }

        const cashKey = formData.devise === 'USD' ? 'cash_usd' : 'cash_cdf';
        if (globalBalance[cashKey] < formData.montant) {
          throw new Error(
            `Solde cash insuffisant. Solde disponible: ${globalBalance[cashKey].toFixed(2)} ${formData.devise}`
          );
        }
      }

      const transactionData: any = {
        type: formData.type,
        service_id: formData.service_id,
        montant: formData.montant,
        devise: formData.devise,
        info_client: formData.info_client || null,
        notes: formData.notes || null,
        created_by: user?.id,
      };

      if (formData.reference_manuelle.trim()) {
        transactionData.reference = formData.reference_manuelle.trim();
      }

      const { data: transaction, error: insertError } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase.from('audit_logs').insert({
        table_name: 'transactions',
        operation: 'INSERT',
        record_id: transaction.id,
        new_data: {
          type: formData.type,
          service: service.nom,
          montant: formData.montant,
          devise: formData.devise,
          reference: transaction.reference,
        },
        user_id: user?.id,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as 'depot' | 'retrait' })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="depot">Dépôt</option>
            <option value="retrait">Retrait</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Devise</label>
          <select
            value={formData.devise}
            onChange={(e) =>
              setFormData({ ...formData, devise: e.target.value as 'USD' | 'CDF' })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Service</label>
        <select
          value={formData.service_id}
          onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          required
        >
          <option value="">Sélectionner un service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Montant</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={formData.montant || ''}
          onChange={(e) =>
            setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })
          }
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Référence <span className="text-slate-500 font-normal">(optionnel)</span>
        </label>
        <input
          type="text"
          value={formData.reference_manuelle}
          onChange={(e) => setFormData({ ...formData, reference_manuelle: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="Ex: TRX-2024-001"
        />
        <p className="text-xs text-slate-500 mt-1">
          Laissez vide pour génération automatique. La référence doit être unique.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Info client <span className="text-slate-500 font-normal">(optionnel)</span>
        </label>
        <input
          type="text"
          value={formData.info_client}
          onChange={(e) => setFormData({ ...formData, info_client: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="Nom du client, téléphone, etc."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Notes <span className="text-slate-500 font-normal">(optionnel)</span>
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          rows={3}
          placeholder="Informations supplémentaires..."
        />
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Créer la transaction'}
        </button>
      </div>
    </form>
  );
}
