import { Activity } from 'lucide-react';

interface ActivityData {
  hour: string;
  depots: number;
  retraits: number;
}

interface DailyActivityChartProps {
  todayTransactions: Array<{
    type: 'depot' | 'retrait';
    montant: number;
    created_at: string;
  }>;
}

export function DailyActivityChart({ todayTransactions }: DailyActivityChartProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const activityByHour: ActivityData[] = hours.map((hour) => {
    const hourStr = hour.toString().padStart(2, '0');
    const hourTransactions = todayTransactions.filter((t) => {
      const txHour = new Date(t.created_at).getHours();
      return txHour === hour;
    });

    const depots = hourTransactions
      .filter((t) => t.type === 'depot')
      .reduce((sum, t) => sum + t.montant, 0);

    const retraits = hourTransactions
      .filter((t) => t.type === 'retrait')
      .reduce((sum, t) => sum + t.montant, 0);

    return {
      hour: hourStr + 'h',
      depots,
      retraits,
    };
  });

  const maxValue = Math.max(
    ...activityByHour.map((d) => Math.max(d.depots, d.retraits)),
    1
  );

  const currentHour = new Date().getHours();
  const relevantData = activityByHour.slice(
    Math.max(0, currentHour - 11),
    currentHour + 1
  );

  const totalDepots = todayTransactions
    .filter((t) => t.type === 'depot')
    .reduce((sum, t) => sum + t.montant, 0);

  const totalRetraits = todayTransactions
    .filter((t) => t.type === 'retrait')
    .reduce((sum, t) => sum + t.montant, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Activité du jour</h2>
            <p className="text-sm text-slate-500">{todayTransactions.length} transactions</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-emerald-50 rounded-lg">
          <p className="text-sm text-slate-600 mb-1">Total Dépôts</p>
          <p className="text-2xl font-bold text-emerald-600">
            {new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(totalDepots)}
          </p>
        </div>
        <div className="p-4 bg-rose-50 rounded-lg">
          <p className="text-sm text-slate-600 mb-1">Total Retraits</p>
          <p className="text-2xl font-bold text-rose-600">
            {new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(totalRetraits)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {relevantData.length === 0 || relevantData.every((d) => d.depots === 0 && d.retraits === 0) ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">Aucune activité enregistrée aujourd'hui</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-end space-x-4 text-xs text-slate-600 mb-2">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                <span>Dépôts</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-rose-500 rounded"></div>
                <span>Retraits</span>
              </div>
            </div>
            {relevantData.map((data) => (
              <div key={data.hour} className="flex items-center space-x-2">
                <span className="text-xs text-slate-600 w-10">{data.hour}</span>
                <div className="flex-1 flex space-x-1">
                  <div
                    className="bg-emerald-500 rounded transition-all"
                    style={{
                      width: `${(data.depots / maxValue) * 100}%`,
                      minWidth: data.depots > 0 ? '2px' : '0',
                      height: '20px',
                    }}
                    title={`Dépôts: ${data.depots.toFixed(0)}`}
                  />
                  <div
                    className="bg-rose-500 rounded transition-all"
                    style={{
                      width: `${(data.retraits / maxValue) * 100}%`,
                      minWidth: data.retraits > 0 ? '2px' : '0',
                      height: '20px',
                    }}
                    title={`Retraits: ${data.retraits.toFixed(0)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
