import { TrendingUp } from 'lucide-react';

interface TreasuryCardProps {
  cashUsd: number;
  cashCdf: number;
  virtuelUsd: number;
  virtuelCdf: number;
  tauxChange: number;
}

export function TreasuryCard({
  cashUsd,
  cashCdf,
  virtuelUsd,
  virtuelCdf,
  tauxChange,
}: TreasuryCardProps) {
  const totalCashUsd = cashUsd;
  const totalCashCdf = cashCdf;
  const totalVirtuelUsd = virtuelUsd;
  const totalVirtuelCdf = virtuelCdf;

  return (
    <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl p-6 text-white shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium opacity-90 mb-1">Trésorerie Totale</h3>
          <div className="space-y-1">
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(totalCashUsd + totalVirtuelUsd)}{' '}
              <span className="text-lg">USD</span>
            </p>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(totalCashCdf + totalVirtuelCdf)}{' '}
              <span className="text-lg">CDF</span>
            </p>
          </div>
        </div>
        <div className="p-4 bg-white/20 rounded-lg">
          <TrendingUp className="w-8 h-8" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
        <div>
          <p className="text-xs opacity-75 mb-2">Cash Total</p>
          <p className="text-base font-semibold">
            {new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(totalCashUsd)}{' '}
            USD
          </p>
          <p className="text-base font-semibold mt-1">
            {new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(totalCashCdf)}{' '}
            CDF
          </p>
        </div>
        <div>
          <p className="text-xs opacity-75 mb-2">Virtuel Total</p>
          <p className="text-base font-semibold">
            {new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(totalVirtuelUsd)}{' '}
            USD
          </p>
          <p className="text-base font-semibold mt-1">
            {new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(totalVirtuelCdf)}{' '}
            CDF
          </p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-white/10 rounded-lg">
        <p className="text-xs opacity-75 mb-1">Taux de change de référence</p>
        <p className="text-sm font-medium">
          1 USD = {tauxChange.toFixed(2)} CDF
        </p>
      </div>
    </div>
  );
}
