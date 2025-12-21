import { LucideIcon } from 'lucide-react';

interface CardBalanceProps {
  title: string;
  amount: number;
  currency: 'USD' | 'CDF';
  icon: LucideIcon;
  color: 'emerald' | 'blue' | 'amber' | 'rose';
}

const colorClasses = {
  emerald: 'from-emerald-500 to-emerald-600',
  blue: 'from-blue-500 to-blue-600',
  amber: 'from-amber-500 to-amber-600',
  rose: 'from-rose-500 to-rose-600',
};

export function CardBalance({ title, amount, currency, icon: Icon, color }: CardBalanceProps) {
  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 text-white shadow-lg`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-white/20 rounded-lg">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-sm font-medium opacity-90 mb-1">{title}</h3>
      <p className="text-3xl font-bold">
        {formattedAmount} <span className="text-lg">{currency}</span>
      </p>
    </div>
  );
}
