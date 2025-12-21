import { DollarSign, Wallet } from 'lucide-react';

interface ServiceBalance {
  id: string;
  service_name: string;
  service_code: string;
  type_compte: 'cash' | 'virtuel';
  virtual_usd: number;
  virtual_cdf: number;
  is_active: boolean;
  last_updated: string;
}

interface ServiceBalancesProps {
  services: ServiceBalance[];
}

export default function ServiceBalances({ services }: ServiceBalancesProps) {
  const formatCurrency = (amount: number, currency: 'USD' | 'CDF') => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getTotalUSD = () => {
    return services.reduce((sum, service) => sum + service.virtual_usd, 0);
  };

  const getTotalCDF = () => {
    return services.reduce((sum, service) => sum + service.virtual_cdf, 0);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Wallet className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Soldes par Service</h2>
            <p className="text-sm text-gray-500">Détails des balances virtuelles</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Services actifs</div>
          <div className="text-2xl font-bold text-gray-900">{services.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {services.map((service) => (
          <div
            key={service.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">{service.service_name}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{service.service_code}</p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  service.type_compte === 'virtuel'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {service.type_compte}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">USD</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-900">
                    ${formatCurrency(service.virtual_usd, 'USD')}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">CDF</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-900">
                    {formatCurrency(service.virtual_cdf, 'CDF')} FC
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                Dernière mise à jour: {new Date(service.last_updated).toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-700" />
              <span className="text-sm font-medium text-green-900">Total Virtuel USD</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              ${formatCurrency(getTotalUSD(), 'USD')}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Wallet className="w-5 h-5 text-blue-700" />
              <span className="text-sm font-medium text-blue-900">Total Virtuel CDF</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {formatCurrency(getTotalCDF(), 'CDF')} FC
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
