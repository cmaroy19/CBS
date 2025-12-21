import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { MultiLineTransactionService } from '../../lib/multiLineTransactions';
import { MixedPaymentModal } from './MixedPaymentModal';
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
    commission: 0,
    info_client: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [tauxChange, setTauxChange] = useState(0);

  // Récupérer le taux de change actif
  useEffect(() => {
    const fetchExchangeRate = async () => {
      const { data } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('actif', true)
        .eq('devise_source', 'USD')
        .eq('devise_destination', 'CDF')
        .maybeSingle();

      if (data) {
        setTauxChange(data.taux);
      }
    };

    fetchExchangeRate();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation des données
    if (!formData.service_id) {
      setError('Veuillez sélectionner un service');
      return;
    }

    if (formData.montant <= 0) {
      setError('Le montant doit être supérieur à zéro');
      return;
    }

    if (!tauxChange) {
      setError('Taux de change non disponible. Veuillez configurer les taux de change.');
      return;
    }

    // Afficher la modale de confirmation
    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async (
    useMixed: boolean,
    montantPrincipal?: number,
    montantSecondaire?: number
  ) => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      const service = services.find((s) => s.id === formData.service_id);
      if (!service) {
        throw new Error('Service non trouvé');
      }

      if (!useMixed) {
        // Transaction simple (une seule devise)
        await createSimpleTransaction(service);
      } else {
        // Transaction mixte (multi-devise)
        if (!montantPrincipal || !montantSecondaire) {
          throw new Error('Montants invalides pour le paiement mixte');
        }
        await createMixedTransaction(service, montantPrincipal, montantSecondaire);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la transaction');
    } finally {
      setLoading(false);
    }
  };

  const createSimpleTransaction = async (service: Service) => {
    const lines = [];

    if (formData.type === 'depot') {
      lines.push({
        ligne_numero: 1,
        type_portefeuille: 'cash' as const,
        devise: formData.devise,
        sens: 'debit' as const,
        montant: formData.montant,
        description: `Dépôt ${formData.montant.toFixed(2)} ${formData.devise}`,
      });

      lines.push({
        ligne_numero: 2,
        type_portefeuille: 'virtuel' as const,
        service_id: service.id,
        devise: formData.devise,
        sens: 'credit' as const,
        montant: formData.montant,
        description: `Crédit service ${service.nom}`,
      });
    } else {
      lines.push({
        ligne_numero: 1,
        type_portefeuille: 'virtuel' as const,
        service_id: service.id,
        devise: formData.devise,
        sens: 'debit' as const,
        montant: formData.montant,
        description: `Débit service ${service.nom}`,
      });

      lines.push({
        ligne_numero: 2,
        type_portefeuille: 'cash' as const,
        devise: formData.devise,
        sens: 'credit' as const,
        montant: formData.montant,
        description: `Retrait ${formData.montant.toFixed(2)} ${formData.devise}`,
      });
    }

    const description = formData.notes
      ? `${formData.type === 'depot' ? 'Dépôt' : 'Retrait'} simple - ${formData.notes}`
      : `${formData.type === 'depot' ? 'Dépôt' : 'Retrait'} simple`;

    const { data, error } = await MultiLineTransactionService.createTransaction(
      {
        type_operation: formData.type,
        devise_reference: formData.devise,
        montant_total: formData.montant,
        description,
        info_client: formData.info_client || undefined,
      },
      lines
    );

    if (error) throw error;
    if (!data) throw new Error('Erreur lors de la création de la transaction');

    await supabase.from('audit_logs').insert({
      table_name: 'transaction_headers',
      operation: 'INSERT',
      record_id: data.header.id,
      new_data: {
        type: formData.type,
        service: service.nom,
        montant: formData.montant,
        devise: formData.devise,
        reference: data.header.reference,
      },
      user_id: user?.id,
    });
  };

  const createMixedTransaction = async (
    service: Service,
    montantPrincipal: number,
    montantSecondaire: number
  ) => {
    const deviseSecondaire = formData.devise === 'USD' ? 'CDF' : 'USD';
    const montantRestant = formData.montant - montantPrincipal;

    const lines = [];

    if (formData.type === 'depot') {
      // DÉPÔT MIXTE
      // Le client DÉPOSE de l'argent sur son compte virtuel
      // L'agent REÇOIT le cash du client et ENVOIE le virtuel au client

      // Lignes en devise principale
      lines.push({
        ligne_numero: 1,
        type_portefeuille: 'cash' as const,
        devise: formData.devise,
        sens: 'debit' as const,
        montant: montantPrincipal,
        description: `Dépôt ${montantPrincipal.toFixed(2)} ${formData.devise}`,
      });

      lines.push({
        ligne_numero: 2,
        type_portefeuille: 'change' as const,
        devise: formData.devise,
        sens: 'debit' as const,
        montant: montantRestant,
        description: `Change entrant ${montantRestant.toFixed(2)} ${formData.devise}`,
      });

      lines.push({
        ligne_numero: 3,
        type_portefeuille: 'virtuel' as const,
        service_id: service.id,
        devise: formData.devise,
        sens: 'credit' as const,
        montant: formData.montant,
        description: `Crédit service ${service.nom}`,
      });

      // Lignes en devise secondaire (équilibrage du change)
      lines.push({
        ligne_numero: 4,
        type_portefeuille: 'cash' as const,
        devise: deviseSecondaire,
        sens: 'debit' as const,
        montant: montantSecondaire,
        description: `Dépôt ${montantSecondaire.toFixed(2)} ${deviseSecondaire}`,
      });

      lines.push({
        ligne_numero: 5,
        type_portefeuille: 'change' as const,
        devise: deviseSecondaire,
        sens: 'credit' as const,
        montant: montantSecondaire,
        description: `Change sortant ${montantSecondaire.toFixed(2)} ${deviseSecondaire}`,
      });
    } else {
      // RETRAIT MIXTE
      // Le client RETIRE de l'argent de son compte virtuel
      // L'agent REÇOIT le virtuel du client et DONNE le cash au client

      // Lignes en devise principale
      lines.push({
        ligne_numero: 1,
        type_portefeuille: 'virtuel' as const,
        service_id: service.id,
        devise: formData.devise,
        sens: 'debit' as const,
        montant: formData.montant,
        description: `Débit service ${service.nom}`,
      });

      lines.push({
        ligne_numero: 2,
        type_portefeuille: 'cash' as const,
        devise: formData.devise,
        sens: 'credit' as const,
        montant: montantPrincipal,
        description: `Retrait ${montantPrincipal.toFixed(2)} ${formData.devise}`,
      });

      lines.push({
        ligne_numero: 3,
        type_portefeuille: 'change' as const,
        devise: formData.devise,
        sens: 'credit' as const,
        montant: montantRestant,
        description: `Change sortant ${montantRestant.toFixed(2)} ${formData.devise}`,
      });

      // Lignes en devise secondaire (équilibrage du change)
      lines.push({
        ligne_numero: 4,
        type_portefeuille: 'change' as const,
        devise: deviseSecondaire,
        sens: 'debit' as const,
        montant: montantSecondaire,
        description: `Change entrant ${montantSecondaire.toFixed(2)} ${deviseSecondaire}`,
      });

      lines.push({
        ligne_numero: 5,
        type_portefeuille: 'cash' as const,
        devise: deviseSecondaire,
        sens: 'credit' as const,
        montant: montantSecondaire,
        description: `Retrait ${montantSecondaire.toFixed(2)} ${deviseSecondaire}`,
      });
    }

    const { data, error } = await MultiLineTransactionService.createTransaction(
      {
        type_operation: formData.type,
        devise_reference: formData.devise,
        montant_total: formData.montant,
        description: `${formData.type === 'depot' ? 'Dépôt' : 'Retrait'} mixte - ${service.nom}`,
        info_client: formData.info_client || undefined,
        taux_change: tauxChange,
        paire_devises: 'USD/CDF',
      },
      lines
    );

    if (error) throw error;

    // Valider immédiatement la transaction
    if (data?.header.id) {
      await MultiLineTransactionService.validateTransaction(data.header.id);
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

      <div className="grid grid-cols-2 gap-4">
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
          <label className="block text-sm font-medium text-slate-700 mb-2">Commission</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.commission || ''}
            onChange={(e) =>
              setFormData({ ...formData, commission: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Référence</label>
        <input
          type="text"
          value="Automatique"
          readOnly
          disabled
          className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
          placeholder="DD-MM-YYYY-####"
        />
        <p className="text-xs text-slate-500 mt-1">
          La référence sera générée automatiquement au format DD-MM-YYYY-####
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

      {/* Modale de confirmation avec option paiement mixte */}
      {showConfirmModal && (
        <MixedPaymentModal
          montantTotal={formData.montant}
          devise={formData.devise}
          type={formData.type}
          tauxChange={tauxChange}
          onConfirm={handleConfirmTransaction}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </form>
  );
}
