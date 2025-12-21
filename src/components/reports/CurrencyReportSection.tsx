import { DollarSign, Banknote, TrendingUp, Activity } from 'lucide-react';

interface CurrencyData {
  transactions: {
    depots: { count: number; volume: number; commissions: number };
    retraits: { count: number; volume: number; commissions: number };
  };
  approvisionnements: {
    entrees: { count: number; volume: number };
    sorties: { count: number; volume: number };
  };
  total: {
    operations: number;
    volume: number;
    commissions: number;
  };
}

interface CurrencyReportSectionProps {
  currency: 'USD' | 'CDF';
  data: CurrencyData;
}

export function CurrencyReportSection({ currency, data }: CurrencyReportSectionProps) {
  const isUSD = currency === 'USD';
  const bgGradient = isUSD ? 'from-emerald-500 to-emerald-600' : 'from-blue-500 to-blue-600';
  const Icon = isUSD ? DollarSign : Banknote;

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`bg-gradient-to-r ${bgGradient} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/20 rounded-lg">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Rapport {currency}</h2>
              <p className="text-white/90 text-sm">Détail des opérations en {currency}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/90 text-sm">Total opérations</p>
            <p className="text-3xl font-bold text-white">{data.total.operations}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-4 h-4 text-slate-600" />
              <p className="text-sm font-medium text-slate-700">Volume Total</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatNumber(data.total.volume)}</p>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-slate-700">Commissions</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatNumber(data.total.commissions)}</p>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-slate-600" />
              <p className="text-sm font-medium text-slate-700">Taux Commission</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {data.total.volume > 0
                ? ((data.total.commissions / data.total.volume) * 100).toFixed(2)
                : '0.00'}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Marge moyenne</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Transactions</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Dépôts</p>
                <p className="text-xs text-slate-600 mt-1">{data.transactions.depots.count} opérations</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{formatNumber(data.transactions.depots.volume)}</p>
                <p className="text-xs text-emerald-600">Comm: {formatNumber(data.transactions.depots.commissions)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Retraits</p>
                <p className="text-xs text-slate-600 mt-1">{data.transactions.retraits.count} opérations</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{formatNumber(data.transactions.retraits.volume)}</p>
                <p className="text-xs text-emerald-600">Comm: {formatNumber(data.transactions.retraits.commissions)}</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Approvisionnements</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Entrées</p>
                <p className="text-xs text-slate-600 mt-1">{data.approvisionnements.entrees.count} opérations</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{formatNumber(data.approvisionnements.entrees.volume)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Sorties</p>
                <p className="text-xs text-slate-600 mt-1">{data.approvisionnements.sorties.count} opérations</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{formatNumber(data.approvisionnements.sorties.volume)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
