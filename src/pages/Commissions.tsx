import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { Modal } from '../components/ui/Modal';
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import type { CommissionJournaliere } from '../types';

export function Commissions() {
  const { user } = useAuthStore();
  const services = useDataStore(state => state.services);
  const [commissions, setCommissions] = useState<CommissionJournaliere[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [formData, setFormData] = useState({
    date_cloture: new Date().toISOString().split('T')[0],
    commission_usd: '',
    commission_cdf: '',
    service_id: '',
    notes: '',
  });

  const loadCommissions = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('commissions_journalieres')
        .select('*, service:services(*), saisie_par_user:users!commissions_journalieres_saisie_par_fkey(*)')
        .gte('date_cloture', startDate)
        .lte('date_cloture', endDate)
        .order('date_cloture', { ascending: false });

      if (error) throw error;
      setCommissions(data || []);
    } catch (err) {
      console.error('Error loading commissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommissions();
  }, [selectedMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('commissions_journalieres')
        .insert({
          date_cloture: formData.date_cloture,
          commission_usd: parseFloat(formData.commission_usd) || 0,
          commission_cdf: parseFloat(formData.commission_cdf) || 0,
          service_id: formData.service_id || null,
          notes: formData.notes || null,
          saisie_par: user?.id,
        });

      if (error) throw error;

      setIsModalOpen(false);
      setFormData({
        date_cloture: new Date().toISOString().split('T')[0],
        commission_usd: '',
        commission_cdf: '',
        service_id: '',
        notes: '',
      });
      loadCommissions();
    } catch (err: any) {
      console.error('Error saving commission:', err);
      alert(err.message || 'Erreur lors de la sauvegarde');
    }
  };

  const canAddCommission = ['caissier', 'gerant', 'proprietaire', 'administrateur'].includes(user?.role || '');

  const calculateComparison = (currentIndex: number) => {
    if (currentIndex >= commissions.length - 1) return null;

    const current = commissions[currentIndex];
    const previous = commissions[currentIndex + 1];

    if (!previous) return null;

    const diffUsd = current.commission_usd - previous.commission_usd;
    const diffCdf = current.commission_cdf - previous.commission_cdf;

    return { diffUsd, diffCdf, previous };
  };

  const totalUsd = commissions.reduce((sum, c) => sum + c.commission_usd, 0);
  const totalCdf = commissions.reduce((sum, c) => sum + c.commission_cdf, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <p className="text-slate-600">Chargement des commissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Commissions Journalières</h1>
          <p className="text-slate-600">Saisie manuelle des commissions observées dans le POS</p>
        </div>
        {canAddCommission && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Saisir commission</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            <label className="text-sm font-medium text-slate-700">Mois :</label>
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Total USD</h3>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">
            {totalUsd.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm opacity-80 mt-1">{commissions.length} enregistrements</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Total CDF</h3>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-bold">
            {totalCdf.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm opacity-80 mt-1">{commissions.length} enregistrements</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Commission USD
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Commission CDF
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Comparaison
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Saisi par
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Aucune commission enregistrée pour ce mois
                  </td>
                </tr>
              ) : (
                commissions.map((commission, index) => {
                  const comparison = calculateComparison(index);
                  return (
                    <tr key={commission.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {new Date(commission.date_cloture).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {commission.service?.nom || 'Global'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                        {commission.commission_usd.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        USD
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                        {commission.commission_cdf.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        CDF
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {comparison && (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              {comparison.diffUsd >= 0 ? (
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                              )}
                              <span
                                className={
                                  comparison.diffUsd >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }
                              >
                                {comparison.diffUsd > 0 ? '+' : ''}
                                {comparison.diffUsd.toFixed(2)} USD
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {comparison.diffCdf >= 0 ? (
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                              )}
                              <span
                                className={
                                  comparison.diffCdf >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }
                              >
                                {comparison.diffCdf > 0 ? '+' : ''}
                                {comparison.diffCdf.toFixed(2)} CDF
                              </span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {commission.saisie_par_user?.nom_complet || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {commission.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Saisir une commission journalière"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Date de clôture
            </label>
            <input
              type="date"
              value={formData.date_cloture}
              onChange={(e) => setFormData({ ...formData, date_cloture: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Service (optionnel)
            </label>
            <select
              value={formData.service_id}
              onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Global (tous services)</option>
              {services
                .filter((s) => s.actif)
                .map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.nom}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Commission USD
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.commission_usd}
                onChange={(e) => setFormData({ ...formData, commission_usd: e.target.value })}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Commission CDF
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.commission_cdf}
                onChange={(e) => setFormData({ ...formData, commission_cdf: e.target.value })}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes (optionnel)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Observations ou remarques..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
