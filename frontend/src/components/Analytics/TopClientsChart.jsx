import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <p className="font-medium text-slate-900 dark:text-white mb-1">{data.displayName}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        CA: {formatCurrency(data.totalRevenue)}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500">
        {data.invoiceCount} facture{data.invoiceCount > 1 ? 's' : ''}
      </p>
    </div>
  );
};

export default function TopClientsChart({ data }) {
  if (!data?.length) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Top 5 Clients
        </h3>
        <div className="flex items-center justify-center h-[250px] text-slate-400">
          Aucune donnée client
        </div>
      </div>
    );
  }

  // Transform and truncate names for display
  const chartData = data.map((client, index) => ({
    ...client,
    displayName: client.company || client.clientName,
    shortName: (client.company || client.clientName).substring(0, 15) +
      ((client.company || client.clientName).length > 15 ? '...' : ''),
    color: COLORS[index % COLORS.length]
  }));

  const formatCurrency = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Top 5 Clients
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <XAxis
            type="number"
            tickFormatter={formatCurrency}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            width={95}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
          <Bar
            dataKey="totalRevenue"
            radius={[0, 6, 6, 0]}
            barSize={28}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
