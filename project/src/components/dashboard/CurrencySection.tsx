import { DollarSign, Banknote } from 'lucide-react';

interface CurrencySectionProps {
  currency: 'USD' | 'CDF';
  cashBalance: number;
  virtualBalance: number;
  commissions: number;
  totalGeneral: number;
}

export function CurrencySection({
  currency,
  cashBalance,
  virtualBalance,
  commissions,
  totalGeneral,
}: CurrencySectionProps) {
  const isUSD = currency === 'USD';
  const bgGradient = isUSD
    ? 'from-emerald-500 to-emerald-600'
    : 'from-blue-500 to-blue-600';
  const Icon = isUSD ? DollarSign : Banknote;

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`bg-gradient-to-r ${bgGradient} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{currency}</h2>
            <p className="text-white/90 text-sm">Soldes et commissions</p>
          </div>
          <div className="p-3 bg-white/20 rounded-lg">
            <Icon className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <p className="text-sm text-slate-600 mb-1">Solde Cash</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatNumber(cashBalance)}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${isUSD ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              Cash
            </div>
          </div>

          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <p className="text-sm text-slate-600 mb-1">Solde Virtuel</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatNumber(virtualBalance)}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${isUSD ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
              Virtuel
            </div>
          </div>

          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <p className="text-sm text-slate-600 mb-1">Commissions</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatNumber(commissions)}
              </p>
            </div>
            <div className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
              Commission
            </div>
          </div>

          <div className={`flex justify-between items-center p-4 rounded-lg bg-gradient-to-r ${bgGradient}`}>
            <div>
              <p className="text-sm text-white/90 mb-1">Total Général</p>
              <p className="text-3xl font-bold text-white">
                {formatNumber(totalGeneral)}
              </p>
              <p className="text-white/80 text-xs mt-1">
                {currency}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
