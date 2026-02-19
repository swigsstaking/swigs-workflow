import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { settingsApi, remindersApi, portalApi, abaninjaApi } from '../../services/api';
import ConfirmDialog from '../ui/ConfirmDialog';
import NewInvoiceModal from './NewInvoiceModal';
import NewQuoteModal from './NewQuoteModal';
import InvoiceList from './documents/InvoiceList';
import QuoteList from './documents/QuoteList';

export default function DocumentsTab({ project }) {
  const { projectInvoices, projectQuotes, updateInvoiceStatus, updateQuoteStatus, deleteInvoice, deleteQuote, fetchProjectInvoices, fetchProjectQuotes } = useProjectStore();
  const { addToast } = useToastStore();

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [preselectedQuoteId, setPreselectedQuoteId] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteQuoteConfirm, setDeleteQuoteConfirm] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await settingsApi.get();
      setSettings(data.data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount);
  };

  const handleInvoiceStatusChange = async (id, status) => {
    try {
      await updateInvoiceStatus(id, status);
      addToast({ type: 'success', message: 'Statut de la facture mis à jour' });
      setActiveMenu(null);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors du changement de statut' });
    }
  };

  const handleQuoteStatusChange = async (id, status) => {
    try {
      await updateQuoteStatus(id, status);
      addToast({ type: 'success', message: 'Statut du devis mis à jour' });
      setActiveMenu(null);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors du changement de statut' });
    }
  };

  const handleDeleteInvoice = async (id) => {
    try {
      await deleteInvoice(id, project._id);
      setDeleteConfirm(null);
      setActiveMenu(null);
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const handleCreateInvoiceFromQuote = (quoteId) => {
    setPreselectedQuoteId(quoteId);
    setShowInvoiceModal(true);
    setActiveMenu(null);
  };

  const handleCloseInvoiceModal = () => {
    setShowInvoiceModal(false);
    setPreselectedQuoteId(null);
  };

  const handleEditQuote = (quote) => {
    setEditingQuote(quote);
    setShowQuoteModal(true);
    setActiveMenu(null);
  };

  const handleDeleteQuote = async (id) => {
    try {
      await deleteQuote(id, project._id);
      setDeleteQuoteConfirm(null);
      setActiveMenu(null);
    } catch (error) {
      console.error('Error deleting quote:', error);
      addToast({ type: 'error', message: error.response?.data?.error || 'Erreur lors de la suppression du devis' });
    }
  };

  const handleCloseQuoteModal = () => {
    setShowQuoteModal(false);
    setEditingQuote(null);
  };

  // Check if a quote can be deleted
  const canDeleteQuote = (quote) => {
    // Cannot delete if invoiced or partially invoiced
    if (['partial', 'invoiced'].includes(quote.status)) return false;
    // Cannot delete signed quote if already partially invoiced
    if (quote.status === 'signed' && quote.invoicedAmount > 0) return false;
    return true;
  };

  // Generate mailto link with template
  const generateMailtoLink = (type, document) => {
    const clientEmail = project.client?.email || '';
    if (!clientEmail) return null;

    const templates = settings?.emailTemplates || {};
    const companyName = settings?.company?.name || 'SWIGS';
    const paymentTerms = settings?.invoicing?.defaultPaymentTerms || 30;

    let subject = '';
    let body = '';

    if (type === 'quote') {
      subject = templates.quoteSubject || 'Devis {number} - {projectName}';
      body = templates.quoteBody || 'Bonjour {clientName},\n\nVeuillez trouver ci-joint le devis {number} d\'un montant de {total} CHF.\n\nN\'hésitez pas à me contacter pour toute question.\n\nCordialement,\n{companyName}';
    } else {
      subject = templates.invoiceSubject || 'Facture {number} - {projectName}';
      body = templates.invoiceBody || 'Bonjour {clientName},\n\nVeuillez trouver ci-joint la facture {number} d\'un montant de {total} CHF.\n\nMerci de procéder au règlement dans un délai de {paymentTerms} jours.\n\nCordialement,\n{companyName}';
    }

    // Replace placeholders
    const replacements = {
      '{number}': document.number || '',
      '{projectName}': project.name || '',
      '{clientName}': project.client?.name || '',
      '{total}': formatCurrency(document.total).replace('CHF', '').trim(),
      '{companyName}': companyName,
      '{paymentTerms}': paymentTerms.toString()
    };

    Object.entries(replacements).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
      body = body.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Calculate days overdue
  const getDaysOverdue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // Send reminder
  const handleSendReminder = async (invoiceId) => {
    try {
      await remindersApi.send(invoiceId);
      addToast({ type: 'success', message: 'Relance envoyée avec succès' });
      if (fetchProjectInvoices) {
        fetchProjectInvoices(project._id);
      }
      setActiveMenu(null);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur lors de l\'envoi de la relance' });
    }
  };

  // Generate portal link
  const handleGeneratePortalLink = async (documentId, docType) => {
    try {
      const { data } = await portalApi.generate({ type: docType, documentId });
      const link = `${window.location.origin}/portal/${data.data.token}`;
      await navigator.clipboard.writeText(link);
      addToast({ type: 'success', message: 'Lien copié dans le presse-papier !' });
      setActiveMenu(null);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur génération lien' });
    }
  };

  // Sync with AbaNinja
  const handleSyncAbaNinja = async (docId, docType) => {
    try {
      if (docType === 'invoice') {
        await abaninjaApi.syncInvoice(docId);
      } else if (docType === 'quote') {
        await abaninjaApi.syncQuote(docId);
      }
      addToast({ type: 'success', message: 'Synchronisation AbaNinja réussie' });
      if (docType === 'invoice' && fetchProjectInvoices) {
        fetchProjectInvoices(project._id);
      } else if (docType === 'quote' && fetchProjectQuotes) {
        fetchProjectQuotes(project._id);
      }
      setActiveMenu(null);
    } catch (error) {
      addToast({ type: 'error', message: 'Erreur de synchronisation AbaNinja' });
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* Quotes */}
      <QuoteList
        project={project}
        quotes={projectQuotes}
        settings={settings}
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        deleteQuoteConfirm={deleteQuoteConfirm}
        setDeleteQuoteConfirm={setDeleteQuoteConfirm}
        onStatusChange={handleQuoteStatusChange}
        onDelete={handleDeleteQuote}
        onShowQuoteModal={() => setShowQuoteModal(true)}
        onEdit={handleEditQuote}
        onCreateInvoiceFromQuote={handleCreateInvoiceFromQuote}
        onGeneratePortalLink={handleGeneratePortalLink}
        onSyncAbaNinja={handleSyncAbaNinja}
        canDeleteQuote={canDeleteQuote}
        generateMailtoLink={generateMailtoLink}
        formatCurrency={formatCurrency}
      />

      {/* Invoices */}
      <InvoiceList
        project={project}
        invoices={projectInvoices}
        settings={settings}
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        onStatusChange={handleInvoiceStatusChange}
        onDelete={handleDeleteInvoice}
        onShowInvoiceModal={() => setShowInvoiceModal(true)}
        onSendReminder={handleSendReminder}
        onGeneratePortalLink={handleGeneratePortalLink}
        onSyncAbaNinja={handleSyncAbaNinja}
        generateMailtoLink={generateMailtoLink}
        formatCurrency={formatCurrency}
        getDaysOverdue={getDaysOverdue}
      />

      {/* Modals */}
      <NewInvoiceModal
        project={project}
        isOpen={showInvoiceModal}
        onClose={handleCloseInvoiceModal}
        preselectedQuoteId={preselectedQuoteId}
        vatRate={settings?.invoicing?.defaultVatRate != null ? settings.invoicing.defaultVatRate / 100 : undefined}
      />
      <NewQuoteModal
        project={project}
        isOpen={showQuoteModal}
        onClose={handleCloseQuoteModal}
        editQuote={editingQuote}
      />

      {/* Delete Invoice Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDeleteInvoice(deleteConfirm?._id)}
        title="Supprimer la facture"
        message={`La facture ${deleteConfirm?.number || ''} sera supprimée et tous les événements/devis associés redeviendront non facturés.`}
        confirmLabel="Supprimer"
        variant="danger"
      />

      {/* Delete Quote Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteQuoteConfirm}
        onClose={() => setDeleteQuoteConfirm(null)}
        onConfirm={() => handleDeleteQuote(deleteQuoteConfirm?._id)}
        title="Supprimer le devis"
        message={`Le devis ${deleteQuoteConfirm?.number || ''} sera définitivement supprimé.${deleteQuoteConfirm?.status === 'signed' ? ' ⚠️ Ce devis est signé mais pas encore facturé.' : ''}`}
        confirmLabel="Supprimer"
        variant="danger"
      />
    </div>
  );
}
