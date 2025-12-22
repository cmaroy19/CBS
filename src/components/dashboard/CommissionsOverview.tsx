import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import type { CommissionJournaliere } from '../../types';

export function CommissionsOverview() {
  const [todayCommission, setTodayCommission] = useState<CommissionJournaliere | null>(null);
  const [yesterdayCommission, setYesterdayCommission] = useState<CommissionJournaliere | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommissions();
  }, []);

  const loadCommissions = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const { data: commissions } = await supabase
        .from('commissions_journalieres')
        .select('*')
        .in('date_cloture', [today, yesterday])
        .is('service_id', null)
        .order('date_cloture', { ascending: false });

      if (commissions) {
        const todayData = commissions.find(c => c.date_cloture === today);
        const yesterdayData = commissions.find(c => c.date_cloture === yesterday);

        setTodayCommission(todayData || null);
        setYesterdayCommission(yesterdayData || null);
      }
    } catch (err) {
      console.error('Error loading commissions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-slate-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const diffUsd = todayCommission && yesterdayCommission
    ? todayCommission.commission_usd - yesterdayCommission.commission_usd
    : 0;

  const diffCdf = todayCommission && yesterdayCommission
    ? todayCommission.commission_cdf - yesterdayCommission.commission_cdf
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Commissions du Jour
              </h3>
              <p className="text-sm text-slate-500">Saisies manuellement</p>
            </div>
          </div>
          <Calendar className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      <div className="p-6">
        {!todayCommission ? (
          <div className="text-center py-4">
            <p className="text-slate-500 text-sm">Aucune commission saisie aujourd'hui</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Commission USD</p>
                <p className="text-2xl font-bold text-slate-900">
                  {todayCommission.commission_usd.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  <span className="text-sm font-normal text-slate-500">USD</span>
                </p>
              </div>
              {yesterdayCommission && (
                <div className="flex items-center space-x-2">
                  {diffUsd >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      diffUsd >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {diffUsd > 0 ? '+' : ''}
                    {diffUsd.toFixed(2)} USD
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div>
                <p className="text-sm text-slate-600 mb-1">Commission CDF</p>
                <p className="text-2xl font-bold text-slate-900">
                  {todayCommission.commission_cdf.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  <span className="text-sm font-normal text-slate-500">CDF</span>
                </p>
              </div>
              {yesterdayCommission && (
                <div className="flex items-center space-x-2">
                  {diffCdf >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      diffCdf >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {diffCdf > 0 ? '+' : ''}
                    {diffCdf.toFixed(2)} CDF
                  </span>
                </div>
              )}
            </div>

            {todayCommission.notes && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500 font-medium mb-1">Notes:</p>
                <p className="text-sm text-slate-700">{todayCommission.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
