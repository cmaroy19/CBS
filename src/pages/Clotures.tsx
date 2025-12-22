import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { Modal } from '../components/ui/Modal';
import { Plus, Lock, CheckCircle, AlertTriangle, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import type { ClotureJournaliere, Service } from '../types';

export function Clotures() {
  const { user } = useAuthStore();
  const services = useDataStore(state => state.services);
  const [clotures, setClotures] = useState<ClotureJournaliere[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [formData, setFormData] = useState({
    service_id: '',
    solde_ouverture_usd: '',
    solde_ouverture_cdf: '',
    solde_cloture_usd: '',
    solde_cloture_cdf: '',
    commission_usd: '',
    commission_cdf: '',
    notes: '',
  });

  const loadClotures = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clotures_journalieres')
        .select(`
          *,
          service:services(*),
          validee_par_user:users!clotures_journalieres_validee_par_fkey(*),
          verrouillee_par_user:users!clotures_journalieres_verrouillee_par_fkey(*),
          created_by_user:users!clotures_journalieres_created_by_fkey(*)
        `)
        .eq('date_cloture', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClotures(data || []);
    } catch (err) {
      console.error('Error loading closures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClotures();
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('clotures_journalieres')
        .insert({
          date_cloture: selectedDate,
          service_id: formData.service_id,
          solde_ouverture_usd: parseFloat(formData.solde_ouverture_usd) || 0,
          solde_ouverture_cdf: parseFloat(formData.solde_ouverture_cdf) || 0,
          solde_cloture_usd: parseFloat(formData.solde_cloture_usd) || 0,
          solde_cloture_cdf: parseFloat(formData.solde_cloture_cdf) || 0,
          commission_usd: parseFloat(formData.commission_usd) || 0,
          commission_cdf: parseFloat(formData.commission_cdf) || 0,
          notes: formData.notes || null,
          created_by: user?.id,
          statut: 'brouillon',
        });

      if (error) throw error;

      setIsModalOpen(false);
      setFormData({
        service_id: '',
        solde_ouverture_usd: '',
        solde_ouverture_cdf: '',
        solde_cloture_usd: '',
        solde_cloture_cdf: '',
        commission_usd: '',
        commission_cdf: '',
        notes: '',
      });
      loadClotures();
    } catch (err: any) {
      console.error('Error saving closure:', err);
      alert(err.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleValidate = async (clotureId: string) => {
    if (!confirm('Confirmer la validation de cette clôture ?')) return;

    try {
      const { error } = await supabase
        .from('clotures_journalieres')
        .update({
          statut: 'validee',
          validee_par: user?.id,
          validee_le: new Date().toISOString(),
        })
        .eq('id', clotureId);

      if (error) throw error;
      loadClotures();
    } catch (err: any) {
      console.error('Error validating closure:', err);
      alert(err.message || 'Erreur lors de la validation');
    }
  };

  const handleLock = async (clotureId: string) => {
    if (!confirm('Confirmer le verrouillage de cette clôture ? Cette action est irréversible.')) return;

    try {
      const { error } = await supabase
        .from('clotures_journalieres')
        .update({
          statut: 'verrouillee',
          verrouillee_par: user?.id,
          verrouillee_le: new Date().toISOString(),
        })
        .eq('id', clotureId);

      if (error) throw error;
      loadClotures();
    } catch (err: any) {
      console.error('Error locking closure:', err);
      alert(err.message || 'Erreur lors du verrouillage');
    }
  };

  const canCreateCloture = ['caissier', 'gerant', 'proprietaire', 'administrateur'].includes(user?.role || '');
  const canValidate = ['gerant', 'proprietaire', 'administrateur'].includes(user?.role || '');
  const canLock = ['proprietaire', 'administrateur'].includes(user?.role || '');

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'brouillon':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Brouillon</span>;
      case 'validee':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Validée</span>;
      case 'verrouillee':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Verrouillée</span>;
      default:
        return null;
    }
  };

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <p className="text-slate-600">Chargement des clôtures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Clôtures Journalières</h1>
          <p className="text-slate-600">Clôture et validation des services par journée</p>
        </div>
        {canCreateCloture && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Nouvelle clôture</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-slate-600" />
          <label className="text-sm font-medium text-slate-700">Date :</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <span className="text-sm text-slate-600">
            {clotures.length} clôture{clotures.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {clotures.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500">Aucune clôture pour cette date</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {clotures.map((cloture) => (
            <div key={cloture.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{cloture.service?.nom}</h3>
                    <p className="text-sm text-slate-600">Code: {cloture.service?.code}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatutBadge(cloture.statut)}
                    {cloture.statut === 'brouillon' && canValidate && (
                      <button
                        onClick={() => handleValidate(cloture.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Valider</span>
                      </button>
                    )}
                    {cloture.statut === 'validee' && canLock && (
                      <button
                        onClick={() => handleLock(cloture.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Verrouiller</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Soldes USD</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Ouverture:</span>
                        <span className="font-semibold text-slate-900">{formatNumber(cloture.solde_ouverture_usd)} USD</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Clôture:</span>
                        <span className="font-semibold text-slate-900">{formatNumber(cloture.solde_cloture_usd)} USD</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-emerald-50 rounded">
                        <span className="text-sm text-slate-600">Commission:</span>
                        <span className="font-semibold text-emerald-700">{formatNumber(cloture.commission_usd)} USD</span>
                      </div>
                      <div className={`flex justify-between items-center p-2 rounded ${
                        cloture.ecart_usd === 0
                          ? 'bg-green-50'
                          : cloture.ecart_usd > 0
                          ? 'bg-blue-50'
                          : 'bg-red-50'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {cloture.ecart_usd === 0 ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : cloture.ecart_usd > 0 ? (
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm font-medium">Écart:</span>
                        </div>
                        <span className={`font-bold ${
                          cloture.ecart_usd === 0
                            ? 'text-green-700'
                            : cloture.ecart_usd > 0
                            ? 'text-blue-700'
                            : 'text-red-700'
                        }`}>
                          {cloture.ecart_usd > 0 ? '+' : ''}{formatNumber(cloture.ecart_usd)} USD
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Soldes CDF</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Ouverture:</span>
                        <span className="font-semibold text-slate-900">{formatNumber(cloture.solde_ouverture_cdf)} CDF</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-600">Clôture:</span>
                        <span className="font-semibold text-slate-900">{formatNumber(cloture.solde_cloture_cdf)} CDF</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-emerald-50 rounded">
                        <span className="text-sm text-slate-600">Commission:</span>
                        <span className="font-semibold text-emerald-700">{formatNumber(cloture.commission_cdf)} CDF</span>
                      </div>
                      <div className={`flex justify-between items-center p-2 rounded ${
                        cloture.ecart_cdf === 0
                          ? 'bg-green-50'
                          : cloture.ecart_cdf > 0
                          ? 'bg-blue-50'
                          : 'bg-red-50'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {cloture.ecart_cdf === 0 ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : cloture.ecart_cdf > 0 ? (
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm font-medium">Écart:</span>
                        </div>
                        <span className={`font-bold ${
                          cloture.ecart_cdf === 0
                            ? 'text-green-700'
                            : cloture.ecart_cdf > 0
                            ? 'text-blue-700'
                            : 'text-red-700'
                        }`}>
                          {cloture.ecart_cdf > 0 ? '+' : ''}{formatNumber(cloture.ecart_cdf)} CDF
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {cloture.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 font-medium mb-1">Notes:</p>
                    <p className="text-sm text-slate-700">{cloture.notes}</p>
                  </div>
                )}

                {(cloture.ecart_usd !== 0 || cloture.ecart_cdf !== 0) && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Écart détecté</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Les soldes de clôture ne correspondent pas aux soldes d'ouverture. Veuillez vérifier les transactions.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>Créé par: {cloture.created_by_user?.nom_complet || 'N/A'}</span>
                  {cloture.statut === 'validee' && cloture.validee_par_user && (
                    <span>Validé par: {cloture.validee_par_user.nom_complet}</span>
                  )}
                  {cloture.statut === 'verrouillee' && cloture.verrouillee_par_user && (
                    <span>Verrouillé par: {cloture.verrouillee_par_user.nom_complet}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nouvelle clôture journalière"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Service *
            </label>
            <select
              value={formData.service_id}
              onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Sélectionner un service</option>
              {services
                .filter((s) => s.actif)
                .map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.nom} ({service.code})
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Soldes USD</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Solde ouverture
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.solde_ouverture_usd}
                    onChange={(e) => setFormData({ ...formData, solde_ouverture_usd: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Solde clôture
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.solde_cloture_usd}
                    onChange={(e) => setFormData({ ...formData, solde_cloture_usd: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Commission
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
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Soldes CDF</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Solde ouverture
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.solde_ouverture_cdf}
                    onChange={(e) => setFormData({ ...formData, solde_ouverture_cdf: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Solde clôture
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.solde_cloture_cdf}
                    onChange={(e) => setFormData({ ...formData, solde_cloture_cdf: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Commission
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
