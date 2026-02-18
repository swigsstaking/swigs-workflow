import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

const COLORS = {
  revenue: '#10B981',
  costs: '#EF4444',
  profit: '#3B82F6',
  lastYearRevenue: '#10B981',
  lastYearCosts: '#EF4444',
  lastYearProfit: '#3B82F6'
};

// Custom bar shape with pattern for current month
const PatternBar = (props) => {
  const { x, y, width, height, fill, isCurrentMonth, dataKey } = props;
  const patternId = `pattern-${dataKey}`;

  if (height <= 0) return null;

  return (
    <g>
      {isCurrentMonth && (
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill={fill} />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="3"
            />
          </pattern>
        </defs>
      )}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isCurrentMonth ? `url(#${patternId})` : fill}
        rx={4}
        ry={4}
      />
    </g>
  );
};

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

  const currentData = payload.find(p => !p.dataKey.startsWith('lastYear'));
  const isCurrentMonth = currentData?.payload?.isCurrentMonth;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 min-w-[180px]">
      <p className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        {label}
        {isCurrentMonth && (
          <span className="text-xs font-normal px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
            En cours
          </span>
        )}
      </p>
      <div className="space-y-2">
        {payload.map((entry, index) => {
          const isLastYear = entry.dataKey.startsWith('lastYear');
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: entry.color,
                    opacity: isLastYear ? 0.3 : 1
                  }}
                />
                <span className={`text-sm ${isLastYear ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
                  {isLastYear ? `${entry.name} (N-1)` : entry.name}
                </span>
              </div>
              <span className={`text-sm font-medium ${isLastYear ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function MonthlyChart({ data, showLastYear }) {
  const formatYAxis = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value;
  };

  // Empty state when no billing data
  const hasData = data?.length > 0 && data.some(d => d.revenue > 0 || d.profit > 0);
  if (!hasData) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Évolution Mensuelle (12 mois)
        </h3>
        <div className="flex items-center justify-center h-[350px]">
          <p className="text-slate-400 dark:text-slate-500">Aucune donnée de facturation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
        Évolution Mensuelle (12 mois)
      </h3>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          barCategoryGap="15%"
        >
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
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={formatYAxis}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="square"
            formatter={(value) => (
              <span className="text-sm text-slate-600 dark:text-slate-400">{value}</span>
            )}
          />

          {/* Last year bars (behind current year) */}
          {showLastYear && (
            <>
              <Bar
                dataKey="lastYearRevenue"
                name="Revenus"
                fill={COLORS.lastYearRevenue}
                fillOpacity={0.2}
                radius={[4, 4, 0, 0]}
                barSize={12}
              />
              <Bar
                dataKey="lastYearProfit"
                name="Profit"
                fill={COLORS.lastYearProfit}
                fillOpacity={0.2}
                radius={[4, 4, 0, 0]}
                barSize={12}
              />
            </>
          )}

          {/* Current year bars */}
          <Bar
            dataKey="revenue"
            name="Revenus"
            fill={COLORS.revenue}
            radius={[4, 4, 0, 0]}
            barSize={showLastYear ? 16 : 24}
            shape={(props) => (
              <PatternBar
                {...props}
                isCurrentMonth={props.payload?.isCurrentMonth}
                dataKey="revenue"
              />
            )}
          />
          <Bar
            dataKey="profit"
            name="Profit"
            fill={COLORS.profit}
            radius={[4, 4, 0, 0]}
            barSize={showLastYear ? 16 : 24}
            shape={(props) => (
              <PatternBar
                {...props}
                isCurrentMonth={props.payload?.isCurrentMonth}
                dataKey="profit"
              />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
