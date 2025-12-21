import { AlertTriangle, CheckCircle } from 'lucide-react';

interface Alert {
  type: 'warning' | 'success';
  message: string;
}

interface AlertsPanelProps {
  cashUsd: number;
  cashCdf: number;
  minCashUsd?: number;
  minCashCdf?: number;
}

export function AlertsPanel({
  cashUsd,
  cashCdf,
  minCashUsd = 1000,
  minCashCdf = 1000000,
}: AlertsPanelProps) {
  const alerts: Alert[] = [];

  if (cashUsd < minCashUsd) {
    alerts.push({
      type: 'warning',
      message: `Alerte: Solde cash USD faible (${cashUsd.toFixed(2)} USD). Seuil minimum: ${minCashUsd.toFixed(2)} USD`,
    });
  }

  if (cashCdf < minCashCdf) {
    alerts.push({
      type: 'warning',
      message: `Alerte: Solde cash CDF faible (${cashCdf.toFixed(2)} CDF). Seuil minimum: ${minCashCdf.toFixed(0)} CDF`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: 'success',
      message: 'Tous les soldes sont au-dessus des seuils minimums',
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className={`p-2 rounded-lg ${alerts.some((a) => a.type === 'warning') ? 'bg-amber-100' : 'bg-emerald-100'}`}>
          {alerts.some((a) => a.type === 'warning') ? (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          )}
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Alertes et Notifications</h2>
          <p className="text-sm text-slate-500">
            {alerts.filter((a) => a.type === 'warning').length} alerte(s)
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              alert.type === 'warning'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <div className="flex items-start space-x-3">
              {alert.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              )}
              <p
                className={`text-sm ${
                  alert.type === 'warning' ? 'text-amber-800' : 'text-emerald-800'
                }`}
              >
                {alert.message}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-slate-50 rounded-lg">
        <p className="text-xs text-slate-600">
          <span className="font-medium">Configuration des seuils:</span>
          <br />
          USD: {minCashUsd.toFixed(2)} USD | CDF: {minCashCdf.toFixed(0)} CDF
        </p>
      </div>
    </div>
  );
}
