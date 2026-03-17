import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Receipt, Download, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { portalApi } from '../services/api';
import { formatCurrency, roundTo5ct } from '../utils/format';
import { trackPortalEvent } from '../lib/posthog';

export default function PortalView() {
  const { token } = useParams();
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signature, setSignature] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signedBy, setSignedBy] = useState('');
  const [downloadError, setDownloadError] = useState(null);
  const [signError, setSignError] = useState(null);

  // Detect dark mode from system preference
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);

    const handler = (e) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    loadDocument();
  }, [token]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await portalApi.getDocument(token);
      setPortalData(data.data);
      trackPortalEvent('viewed', { type: data.data?.type });
    } catch (err) {
      setError(err.response?.data?.error || 'Ce lien est invalide ou a expiré');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setDownloadError(null);
    try {
      const response = await portalApi.downloadPDF(token);
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = blobUrl;
      const prefix = portalData?.type === 'invoice' ? 'Facture' : 'Devis';
      link.setAttribute('download', `${prefix}_${portalData?.document?.number}.pdf`);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      trackPortalEvent('pdf_downloaded', { type: portalData?.type, number: portalData?.document?.number });
    } catch (err) {
      setDownloadError('Erreur lors du téléchargement du PDF. Veuillez réessayer.');
    }
  };

  const handleSign = async () => {
    if (!signature.trim()) return;
    setSignError(null);

    try {
      setSigning(true);
      await portalApi.signQuote(token, { signature: signature.trim() });
      setSignedBy(signature.trim());
      setShowSignModal(false);
      setSigned(true);
      trackPortalEvent('quote_signed', { number: portalData?.document?.number });
    } catch (err) {
      setSignError(err.response?.data?.error || 'Erreur lors de la signature. Veuillez réessayer.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-blue-400' : 'border-blue-600'}`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`max-w-md mx-4 p-8 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white'} border shadow-xl`}>
          <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <h1 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Lien invalide
          </h1>
          <p className={`text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  // Signed thank-you screen
  if (signed) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'} px-4`}>
        <div className={`max-w-md mx-auto text-center p-8 rounded-2xl shadow-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Devis signé avec succès
          </h1>
          <p className={`mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Signé par <strong>{signedBy}</strong>
          </p>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Nous avons été notifiés. Vous pouvez fermer cette page.
          </p>
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Télécharger le PDF
          </button>
          {downloadError && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {downloadError}
            </div>
          )}
        </div>
      </div>
    );
  }

  const { type, document: doc, project, company } = portalData;
  const isQuote = type === 'quote';
  const canSign = isQuote && doc.status === 'sent';

  // Use company's primaryColor if available, otherwise default blue
  const primaryColor = company?.primaryColor || '#2563EB';
  const headerStyle = { background: `linear-gradient(to right, ${primaryColor}, ${primaryColor}cc)` };

  // Build lines from document data
  let lines = [];
  if (type === 'invoice') {
    if (doc.events?.length) {
      doc.events.forEach(e => {
        lines.push({
          description: e.description,
          quantity: e.hours || 1,
          unitPrice: e.hourlyRate || e.amount || 0
        });
      });
    }
    if (doc.quotes?.length) {
      doc.quotes.forEach(q => {
        (q.lines || []).forEach(l => lines.push(l));
      });
    }
    if (doc.customLines?.length) {
      doc.customLines.forEach(l => lines.push(l));
    }
  } else if (isQuote) {
    lines = doc.lines || [];
  }

  const subtotal = doc.subtotal || lines.reduce((sum, l) => sum + ((l.quantity || 0) * (l.unitPrice || 0)), 0);
  const vatRate = doc.vatRate || 8.1;
  const vatAmount = doc.vatAmount || subtotal * vatRate / 100;
  const total = doc.total || roundTo5ct(subtotal + vatAmount);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'} py-12 px-4`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className={`rounded-xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white'} border shadow-xl overflow-hidden`}>
          <div className="px-8 py-6" style={headerStyle}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  {company?.name || 'SWIGS'}
                </h1>
                <p className="text-blue-100 text-sm">
                  {[company?.email, company?.phone].filter(Boolean).join(' • ')}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/20">
                {isQuote ? (
                  <FileText className="w-8 h-8 text-white" />
                ) : (
                  <Receipt className="w-8 h-8 text-white" />
                )}
              </div>
            </div>
          </div>

          {/* Document Info */}
          <div className={`px-8 py-6 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isQuote ? 'Devis' : 'Facture'} {doc.number}
                </h2>
                <div className="space-y-2 text-sm">
                  {doc.issueDate && (
                    <div>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Date: </span>
                      <span className={isDark ? 'text-white' : 'text-slate-900'}>
                        {new Date(doc.issueDate).toLocaleDateString('fr-CH')}
                      </span>
                    </div>
                  )}
                  {doc.dueDate && (
                    <div>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Échéance: </span>
                      <span className={isDark ? 'text-white' : 'text-slate-900'}>
                        {new Date(doc.dueDate).toLocaleDateString('fr-CH')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Client
                </h3>
                <div className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <p className="font-semibold">{project?.client?.name}</p>
                  {project?.client?.company && <p>{project.client.company}</p>}
                  {project?.client?.email && <p>{project.client.email}</p>}
                  {project?.client?.address && <p className="mt-1">{project.client.address}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Lines */}
          <div className="px-8 py-6">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <th className={`text-left py-3 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Description
                  </th>
                  <th className={`text-right py-3 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Quantité
                  </th>
                  <th className={`text-right py-3 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Prix unitaire
                  </th>
                  <th className={`text-right py-3 text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className={`border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
                    <td className={`py-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {line.description}
                    </td>
                    <td className={`py-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {line.quantity}
                    </td>
                    <td className={`py-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {formatCurrency(line.unitPrice)}
                    </td>
                    <td className={`py-3 text-right font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {formatCurrency((line.quantity || 0) * (line.unitPrice || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-8 flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{vatRate > 0 ? 'Sous-total HT' : 'Sous-total'}</span>
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>{formatCurrency(subtotal)}</span>
                </div>
                {vatRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>TVA ({vatRate}%)</span>
                    <span className={isDark ? 'text-white' : 'text-slate-900'}>{formatCurrency(vatAmount)}</span>
                  </div>
                )}
                <div className={`flex justify-between text-lg font-bold pt-2 border-t ${isDark ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-900'}`}>
                  <span>{vatRate > 0 ? 'Total TTC' : 'Total'}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className={`px-8 py-6 border-t ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'} space-y-3`}>
            {downloadError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {downloadError}
              </div>
            )}
            <div className="flex justify-between items-center gap-4">
              <div>
                {doc.status === 'signed' && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Devis signé</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Télécharger PDF
                </button>
                {canSign && (
                  <button
                    onClick={() => setShowSignModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Signer ce devis
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className={`text-center text-sm mt-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Document généré par Swigs Pro
        </p>
      </div>

      {/* Sign Modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl shadow-xl p-6 max-w-md w-full ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Signer le devis
            </h3>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Nom du signataire
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => { setSignature(e.target.value); setSignError(null); }}
              placeholder="Votre nom complet"
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                isDark
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            />
            {signError && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {signError}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowSignModal(false); setSignError(null); }}
                disabled={signing}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Annuler
              </button>
              <button
                onClick={handleSign}
                disabled={!signature.trim() || signing}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: primaryColor }}
              >
                {signing ? 'Signature...' : 'Confirmer la signature'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
