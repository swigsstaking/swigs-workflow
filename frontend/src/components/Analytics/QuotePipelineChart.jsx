import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

const COLORS = {
  draft: '#6B7280',
  sent: '#3B82F6',
  signed: '#10B981',
  refused: '#EF4444',
  expired: '#F59E0B',
  invoiced: '#8B5CF6'
};

const LABELS = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  signed: 'Signé',
  refused: 'Refusé',
  expired: 'Expiré',
  invoiced: 'Facturé'
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <p className="text-sm font-medium text-slate-900 dark:text-white">
        {payload[0].payload.label}: {payload[0].value} devis
      </p>
    </div>
  );
};

export default function QuotePipelineChart({ data }) {
  if (!data?.byStatus) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Pipeline Devis
        </h3>
        <div className="flex items-center justify-center h-[250px] text-slate-400">
          Aucun devis
        </div>
      </div>
    );
  }

  // Transform data for horizontal bar chart
  const chartData = Object.entries(data.byStatus).map(([status, count]) => ({
    status,
    label: LABELS[status] || status,
    count,
    color: COLORS[status] || '#6B7280'
  }));

  // Order: draft -> sent -> signed -> invoiced | refused -> expired
  const order = ['draft', 'sent', 'signed', 'invoiced', 'refused', 'expired'];
  chartData.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

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
          Pipeline Devis
        </h3>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Taux de conversion</p>
          <p className="text-lg font-bold text-emerald-500">{data.conversionRate}%</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
          <Bar
            dataKey="count"
            radius={[0, 6, 6, 0]}
            barSize={24}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total devis</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{data.total}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Valeur moyenne</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {formatCurrency(data.averageValue)}
          </p>
        </div>
      </div>
    </div>
  );
}
