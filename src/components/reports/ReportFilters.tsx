import { Building2, DollarSign, FileText } from 'lucide-react';
import type { Service } from '../../types';

interface ReportFiltersProps {
  services: Service[];
  selectedService: string;
  selectedCurrency: string;
  selectedOperationType: string;
  onServiceChange: (serviceId: string) => void;
  onCurrencyChange: (currency: string) => void;
  onOperationTypeChange: (type: string) => void;
}

export function ReportFilters({
  services,
  selectedService,
  selectedCurrency,
  selectedOperationType,
  onServiceChange,
  onCurrencyChange,
  onOperationTypeChange,
}: ReportFiltersProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
      <h3 className="font-semibold text-slate-900 mb-4">Filtres</h3>

      <div className="space-y-4">
        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-2">
            <Building2 className="w-4 h-4" />
            <span>Service</span>
          </label>
          <select
            value={selectedService}
            onChange={(e) => onServiceChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Tous les services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.nom} ({service.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-2">
            <DollarSign className="w-4 h-4" />
            <span>Devise</span>
          </label>
          <select
            value={selectedCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Toutes les devises</option>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-2">
            <FileText className="w-4 h-4" />
            <span>Type d'opération</span>
          </label>
          <select
            value={selectedOperationType}
            onChange={(e) => onOperationTypeChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Toutes les opérations</option>
            <option value="depot">Dépôts</option>
            <option value="retrait">Retraits</option>
            <option value="approvisionnement">Approvisionnements</option>
            <option value="change">Opérations de change</option>
          </select>
        </div>
      </div>
    </div>
  );
}
