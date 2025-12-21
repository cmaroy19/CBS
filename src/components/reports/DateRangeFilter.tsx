import { Calendar } from 'lucide-react';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function DateRangeFilter({
  startDate,
  endDate,
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
    </div>
  );
}
