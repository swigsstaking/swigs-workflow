import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: payload[0].payload.color }}
        />
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          {payload[0].name}: {payload[0].value}
        </span>
      </div>
    </div>
  );
};

export default function ProjectStatusChart({ data }) {
  // Filter out statuses with 0 count
  const chartData = data?.filter(d => d.count > 0) || [];

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Projets par Statut
        </h3>
        <div className="flex items-center justify-center h-[250px] text-slate-400">
          Aucun projet actif
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Projets par Statut
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="count"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {chartData.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {entry.name} ({entry.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
