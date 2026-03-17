import { memo } from 'react';
import { Calculator } from 'lucide-react';

// Simple markdown: **bold**, `code`, ```blocks```, - lists
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={i} className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // List item
    if (/^[-*]\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-[13px] leading-relaxed">
          {renderInline(line.replace(/^[-*]\s/, ''))}
        </li>
      );
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-[13px] leading-relaxed">
          {renderInline(line.replace(/^\d+\.\s/, ''))}
        </li>
      );
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<br key={i} />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-[13px] leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return elements;
}

// Inline formatting: **bold**, *italic*, `code`, Art. XX citations
function renderInline(text) {
  if (!text) return null;

  // Split by patterns, preserving them
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|Art\.\s*\d+[a-z]?\s+[A-ZÀ-Ü]+)/g);

  return parts.map((part, i) => {
    // Bold
    if (/^\*\*(.+)\*\*$/.test(part)) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Inline code
    if (/^`(.+)`$/.test(part)) {
      return <code key={i} className="px-1 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    // Italic
    if (/^\*(.+)\*$/.test(part)) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    // Law citation (Art. XX LTVA)
    if (/^Art\.\s*\d+[a-z]?\s+[A-ZÀ-Ü]+$/.test(part)) {
      return (
        <span key={i} className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

function ToolResultCard({ tool, result }) {
  if (tool === 'calculate_vat' && !result.error) {
    return (
      <div className="flex items-start gap-2 p-2.5 my-1.5 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/30 rounded-lg">
        <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-xs text-emerald-800 dark:text-emerald-300">
          <span className="font-medium">Calcul TVA ({result.rate}%)</span>
          <span className="mx-1.5">—</span>
          HT: {result.net?.toFixed(2)} CHF
          <span className="mx-1">|</span>
          TVA: {result.vat?.toFixed(2)} CHF
          <span className="mx-1">|</span>
          TTC: {result.gross?.toFixed(2)} CHF
        </div>
      </div>
    );
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
          {renderMarkdown(content)}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-primary-500 rounded-sm ml-0.5 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
});

export default AIChatMessage;
