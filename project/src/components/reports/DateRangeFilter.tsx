import { Calendar } from 'lucide-react';

export type PeriodType = 'today' | 'custom';

interface DateRangeFilterProps {
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  onPeriodTypeChange: (type: PeriodType) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function DateRangeFilter({
  periodType,
  startDate,
  endDate,
  onPeriodTypeChange,
  onStartDateChange,
  onEndDateChange,
}: DateRangeFilterProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Calendar className="w-5 h-5 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Période</h3>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onPeriodTypeChange('today')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              periodType === 'today'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => onPeriodTypeChange('custom')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              periodType === 'custom'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Personnalisée
          </button>
        </div>

        {periodType === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date de début
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date de fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
