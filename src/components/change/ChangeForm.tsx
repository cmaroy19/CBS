import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { ArrowRight } from 'lucide-react';

interface ChangeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ChangeForm({ onSuccess, onCancel }: ChangeFormProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    sens: 'usd_to_cdf' as 'usd_to_cdf' | 'cdf_to_usd',
    montant_source: 0,
    taux: 0,
    commission: 0,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const montantConverti = formData.montant_source * formData.taux;
  const montantNet = montantConverti - formData.commission;

  const montant_usd = formData.sens === 'usd_to_cdf' ? formData.montant_source : montantNet;
  const montant_cdf = formData.sens === 'usd_to_cdf' ? montantNet : formData.montant_source;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.montant_source <= 0) {
        throw new Error('Le montant doit être supérieur à zéro');
      }

      if (formData.taux <= 0) {
        throw new Error('Le taux de change doit être supérieur à zéro');
      }

      if (formData.commission < 0) {
        throw new Error('La commission ne peut pas être négative');
      }

      const { data: globalBalance } = await supabase
        .from('global_balances')
        .select('*')
        .maybeSingle();

      if (!globalBalance) {
        throw new Error('Balance globale non trouvée');
      }

      if (formData.sens === 'usd_to_cdf') {
        if (globalBalance.cash_usd < formData.montant_source) {
          throw new Error(
            `Solde USD insuffisant. Solde disponible: ${globalBalance.cash_usd.toFixed(2)} USD`
          );
        }
      } else {
        if (globalBalance.cash_cdf < formData.montant_source) {
          throw new Error(
            `Solde CDF insuffisant. Solde disponible: ${globalBalance.cash_cdf.toFixed(2)} CDF`
          );
        }
      }

      const { data: changeOp, error: insertError } = await supabase
        .from('change_operations')
        .insert({
          montant_usd,
          montant_cdf,
          taux: formData.taux,
          commission: formData.commission,
          sens: formData.sens,
          notes: formData.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (formData.sens === 'usd_to_cdf') {
        await supabase
          .from('global_balances')
          .update({
            cash_usd: globalBalance.cash_usd - formData.montant_source,
            cash_cdf: globalBalance.cash_cdf + montantNet,
          })
          .eq('id', globalBalance.id);
      } else {
        await supabase
          .from('global_balances')
          .update({
            cash_usd: globalBalance.cash_usd + montantNet,
            cash_cdf: globalBalance.cash_cdf - formData.montant_source,
          })
          .eq('id', globalBalance.id);
      }

      await supabase.from('audit_logs').insert({
        table_name: 'change_operations',
        operation: 'INSERT',
        record_id: changeOp.id,
        new_data: {
          sens: formData.sens === 'usd_to_cdf' ? 'USD → CDF' : 'CDF → USD',
          montant_usd,
          montant_cdf,
          taux: formData.taux,
          commission: formData.commission,
        },
        user_id: user?.id,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la transaction de change');
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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Sens de conversion</label>
        <select
          value={formData.sens}
          onChange={(e) =>
            setFormData({ ...formData, sens: e.target.value as 'usd_to_cdf' | 'cdf_to_usd' })
          }
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="usd_to_cdf">USD vers CDF</option>
          <option value="cdf_to_usd">CDF vers USD</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Montant {formData.sens === 'usd_to_cdf' ? 'USD' : 'CDF'}
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.montant_source || ''}
            onChange={(e) =>
              setFormData({ ...formData, montant_source: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Taux de change
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.taux || ''}
            onChange={(e) => setFormData({ ...formData, taux: parseFloat(e.target.value) || 0 })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Commission {formData.sens === 'usd_to_cdf' ? 'CDF' : 'USD'}
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.commission || ''}
          onChange={(e) =>
            setFormData({ ...formData, commission: parseFloat(e.target.value) || 0 })
          }
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="0.00"
        />
      </div>

      {formData.montant_source > 0 && formData.taux > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Montant source:</span>
            <span className="font-semibold text-slate-900">
              {formData.montant_source.toFixed(2)}{' '}
              {formData.sens === 'usd_to_cdf' ? 'USD' : 'CDF'}
            </span>
          </div>
          <div className="flex items-center justify-center py-2">
            <ArrowRight className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Montant converti:</span>
            <span className="font-semibold text-slate-900">
              {montantConverti.toFixed(2)}{' '}
              {formData.sens === 'usd_to_cdf' ? 'CDF' : 'USD'}
            </span>
          </div>
          {formData.commission > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Commission:</span>
                <span className="font-semibold text-rose-600">
                  - {formData.commission.toFixed(2)}{' '}
                  {formData.sens === 'usd_to_cdf' ? 'CDF' : 'USD'}
                </span>
              </div>
              <div className="border-t border-blue-300 pt-2 flex items-center justify-between">
                <span className="font-medium text-slate-700">Montant net:</span>
                <span className="text-lg font-bold text-emerald-600">
                  {montantNet.toFixed(2)}{' '}
                  {formData.sens === 'usd_to_cdf' ? 'CDF' : 'USD'}
                </span>
              </div>
            </>
          )}
        </div>
      )}

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
          {loading ? 'Enregistrement...' : 'Effectuer le change'}
        </button>
      </div>
    </form>
  );
}
