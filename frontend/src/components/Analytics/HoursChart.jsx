import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const data = payload[0]?.payload;
  const isCurrentMonth = data?.isCurrentMonth;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <p className="font-medium text-slate-900 dark:text-white mb-2 flex items-center gap-2">
        {label}
        {isCurrentMonth && (
          <span className="text-xs font-normal px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
            En cours
          </span>
        )}
      </p>
      <div className="space-y-1">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-white">{payload[0].value}h</span> travaillées
        </p>
        {data?.revenue > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Valeur: <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(data.revenue)}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default function HoursChart({ data }) {
  if (!data?.monthly?.length) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Heures Travaillées
        </h3>
        <div className="flex items-center justify-center h-[250px] text-slate-400">
          Aucune donnée
        </div>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Heures Travaillées
        </h3>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total 12 mois</p>
          <p className="text-lg font-bold text-amber-500">{data.totals.hours}h</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart
          data={data.monthly}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            strokeOpacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            dx={-5}
            tickFormatter={(v) => `${v}h`}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="hours"
            stroke="#F59E0B"
            strokeWidth={2}
            fill="url(#colorHours)"
            yAxisId={0}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ce mois</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {data.currentMonth}h
            {data.monthlyChange !== 0 && (
              <span className={`text-sm ml-2 ${data.monthlyChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {data.monthlyChange > 0 ? '+' : ''}{data.monthlyChange}%
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Valeur totale</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatCurrency(data.totals.revenue)}
          </p>
        </div>
      </div>
    </div>
  );
}
