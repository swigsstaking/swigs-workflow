import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Calculator, CheckCircle, XCircle, Users, TrendingUp, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import AISettingToggle from './AISettingToggle';
import AIMissingFieldsForm from './AIMissingFieldsForm';
import AITaxEstimate from './AITaxEstimate';
import AIVatReport from './AIVatReport';

// Custom components for react-markdown
const markdownComponents = {
  h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1.5 text-slate-900 dark:text-zinc-100">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[15px] font-bold mt-3 mb-1.5 text-slate-900 dark:text-zinc-100">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[14px] font-semibold mt-2.5 mb-1 text-slate-800 dark:text-zinc-200">{children}</h3>,
  h4: ({ children }) => <h4 className="text-[13px] font-semibold mt-2 mb-1 text-slate-800 dark:text-zinc-200">{children}</h4>,
  p: ({ children }) => <p className="text-[13px] leading-relaxed my-1">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5 my-1">{children}</ul>,
  ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5 my-1">{children}</ol>,
  li: ({ children }) => <li className="text-[13px] leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-amber-400 dark:border-amber-500 pl-3 my-1.5 text-[12px] text-slate-600 dark:text-zinc-400 italic">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="px-1 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-xs font-mono">{children}</code>
    ) : (
      <pre className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">
        <code>{children}</code>
      </pre>
    ),
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 dark:bg-zinc-800">{children}</thead>,
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 font-semibold text-slate-700 dark:text-zinc-300 border-b border-slate-200 dark:border-zinc-700 text-left">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2.5 py-1.5 text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-zinc-800">
      {children}
    </td>
  ),
  tr: ({ children, isHeader }) => (
    <tr className={isHeader ? '' : ''}>{children}</tr>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 underline hover:no-underline">
      {children}
    </a>
  ),
};

// --- Inline tool result cards ---

function fmtCHF(amount) {
  return Number(amount || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PrerequisitesCard({ configured = [], missing = [] }) {
  return (
    <div className="my-1.5 p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg space-y-1.5 text-xs">
      {configured.map((item, i) => (
        <div key={`ok-${i}`} className="flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-slate-700 dark:text-zinc-300">{item}</span>
        </div>
      ))}
      {missing.map((item, i) => (
        <div key={`miss-${i}`} className="flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-slate-700 dark:text-zinc-300">{item}</span>
        </div>
      ))}
    </div>
  );
}

function ClientStatsCard({ client, clientName, revenue, overdue, projects, hours, quotes, totalRevenue, avgPaymentDays, overdueAmount, projectCount }) {
  // Support both nested (backend) and flat (legacy) prop formats
  const name = client || clientName || 'Client';
  const revTotal = revenue?.total ?? totalRevenue ?? 0;
  const overdueTotal = overdue?.total ?? overdueAmount ?? 0;
  const projCount = projects?.length ?? projectCount ?? 0;
  const unbilledHours = hours?.unbilled ?? 0;

  return (
    <div className="my-1.5 p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-3.5 h-3.5 text-primary-500" />
        <span className="font-semibold text-[13px] text-slate-800 dark:text-zinc-200">{name}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Revenu total" value={`CHF ${fmtCHF(revTotal)}`} color="emerald" />
        <Stat label="Factures en retard" value={`CHF ${fmtCHF(overdueTotal)}`} color={overdueTotal > 0 ? 'red' : 'slate'} />
        <Stat label="Projets" value={projCount} color="slate" />
        <Stat label="Heures non facturées" value={`${unbilledHours}h`} color={unbilledHours > 0 ? 'amber' : 'slate'} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  const colors = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    slate: 'text-slate-800 dark:text-zinc-200',
  };
  return (
    <div>
      <div className="text-[11px] text-slate-500 dark:text-zinc-500">{label}</div>
      <div className={`font-semibold ${colors[color] || colors.slate}`}>{value}</div>
    </div>
  );
}

function CashFlowCard({ projections = [], period }) {
  return (
    <div className="my-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden text-xs">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
        <TrendingUp className="w-3.5 h-3.5 text-primary-500" />
        <span className="text-[13px] font-semibold text-slate-800 dark:text-zinc-200">
          Projection trésorerie{period ? ` — ${period}` : ''}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-slate-500 dark:text-zinc-500 text-[11px]">
              <th className="text-left font-medium px-3 py-1.5">Mois</th>
              <th className="text-right font-medium px-3 py-1.5">Entrées</th>
              <th className="text-right font-medium px-3 py-1.5">Sorties</th>
              <th className="text-right font-medium px-3 py-1.5">Net</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((row, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-zinc-800">
                <td className="px-3 py-1.5 text-slate-700 dark:text-zinc-300">{row.month}</td>
                <td className="px-3 py-1.5 text-right text-emerald-600 dark:text-emerald-400">
                  CHF {fmtCHF(row.inflow ?? row.revenue)}
                </td>
                <td className="px-3 py-1.5 text-right text-red-600 dark:text-red-400">
                  CHF {fmtCHF(row.outflow ?? row.expenses)}
                </td>
                <td className={`px-3 py-1.5 text-right font-medium ${
                  (row.net || 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  CHF {fmtCHF(row.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverdueDetailsCard({ invoices = [] }) {
  return (
    <div className="my-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden text-xs">
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-800/30">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <span className="text-[13px] font-semibold text-red-700 dark:text-red-400">
          Factures en retard ({invoices.length})
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
        {invoices.map((inv, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-800 dark:text-zinc-200">{inv.number}</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 truncate">{inv.client}</div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="font-semibold text-red-600 dark:text-red-400">CHF {fmtCHF(inv.total || inv.amount)}</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-500">
                {inv.daysPastDue}j retard
                {inv.reminderCount > 0 && (
                  <span className="ml-1">({inv.reminderCount} rappel{inv.reminderCount > 1 ? 's' : ''})</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericToolResult({ tool, result }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-left text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        <span className="font-mono text-[11px]">{tool}</span>
        <span className="text-slate-400 dark:text-zinc-600 ml-1">résultat</span>
      </button>
      {expanded && (
        <pre className="px-3 pb-2 text-[11px] font-mono text-slate-600 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResultCard({ tool, result }) {
  // Calculate VAT (existing)
  if (tool === 'calculate_vat' && !result.error) {
    return (
      <div className="flex items-start gap-2 p-2.5 my-1.5 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/30 rounded-lg">
        <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-xs text-emerald-800 dark:text-emerald-300">
          <span className="font-medium">Calcul TVA ({result.rate}%)</span>
          <span className="mx-1.5">&mdash;</span>
          HT: {result.net?.toFixed(2)} CHF
          <span className="mx-1">|</span>
          TVA: {result.vat?.toFixed(2)} CHF
          <span className="mx-1">|</span>
          TTC: {result.gross?.toFixed(2)} CHF
        </div>
      </div>
    );
  }

  // Tax estimation
  if (tool === 'estimate_taxes' && !result.error) {
    return <AITaxEstimate {...result} />;
  }

  // VAT report
  if (tool === 'prepare_vat_report' && !result.error) {
    return <AIVatReport {...result} />;
  }

  // Settings update
  if (tool === 'update_settings') {
    if (result.status === 'success') {
      return (
        <AISettingToggle
          label={result.label}
          description={result.description}
          enabled={result.value}
          onToggle={() => {}}
        />
      );
    }
    if (result.status === 'missing_prerequisites') {
      return (
        <AIMissingFieldsForm
          title={result.message}
          fields={result.missing}
          onSubmit={() => {}}
        />
      );
    }
  }

  // Prerequisites check
  if (tool === 'check_prerequisites' && !result.error) {
    return <PrerequisitesCard {...result} />;
  }

  // Client stats
  if (tool === 'get_client_stats' && !result.error) {
    return <ClientStatsCard {...result} />;
  }

  // Cash flow analysis
  if (tool === 'analyze_cashflow' && !result.error) {
    return <CashFlowCard {...result} />;
  }

  // Overdue invoices
  if (tool === 'get_overdue_details' && !result.error) {
    return <OverdueDetailsCard {...result} />;
  }

  // Generic fallback for unknown tools
  if (!result.error && tool !== 'suggest_category') {
    return <GenericToolResult tool={tool} result={result} />;
  }

  return null;
}

const AIChatMessage = memo(function AIChatMessage({ role, content, toolResults, isStreaming }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-primary-500 text-white text-[13px] leading-relaxed">
          {content}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1">
        <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200">
          {toolResults?.map((tr, i) => (
            <ToolResultCard key={i} tool={tr.tool} result={tr.result} />
          ))}
          {content && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          )}
          {isStreaming && (
            <>
              <span className="inline-block w-1.5 h-4 bg-primary-500 rounded-sm ml-0.5 animate-pulse" />
              {!content && (
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 italic">Analyse en cours… cela peut prendre quelques secondes.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default AIChatMessage;
