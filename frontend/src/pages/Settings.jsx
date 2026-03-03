import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { settingsApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import SettingsLayout from '../components/Settings/SettingsLayout';

import CompanySection from '../components/Settings/sections/CompanySection';
import InvoicingSection from '../components/Settings/sections/InvoicingSection';
import PersonnalisationTab from '../components/Settings/PersonnalisationTab';
import ClientsSection from '../components/Settings/sections/ClientsSection';
import ServicesTab from '../components/Settings/ServicesTab';
import QuoteTemplatesTab from '../components/Settings/QuoteTemplatesTab';
import StatusesSection from '../components/Settings/sections/StatusesSection';
import SmtpSection from '../components/Settings/sections/SmtpSection';
import EmailsSection from '../components/Settings/sections/EmailsSection';
import RemindersSection from '../components/Settings/sections/RemindersSection';
import RecurringSection from '../components/Settings/sections/RecurringSection';
import AbaNinjaSection from '../components/Settings/sections/AbaNinjaSection';
import CmsSection from '../components/Settings/sections/CmsSection';
import BankSection from '../components/Settings/sections/BankSection';
import InvoiceDesignTab from '../components/Settings/InvoiceDesignTab';
import BankAccountsSection from '../components/Settings/sections/BankAccountsSection';
import ExpenseCategoriesSection from '../components/Settings/sections/ExpenseCategoriesSection';
import CounterpartyRulesSection from '../components/Settings/sections/CounterpartyRulesSection';
import UpgradePrompt from '../components/ui/UpgradePrompt';
import { useAuthStore } from '../stores/authStore';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const activeSection = searchParams.get('section') || 'company';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await settingsApi.get();
      setSettings(data.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      addToast({ type: 'error', message: 'Erreur lors du chargement des paramètres' });
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setSearchParams({ section });
  };

  const handleSettingsUpdate = (updatedSettings) => {
    setSettings(updatedSettings);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'company':
        return (
          <CompanySection
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        );
      case 'invoicing':
        return (
          <InvoicingSection
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        );
      case 'recurring':
        return <RecurringSection settings={settings} />;
      case 'personalization':
        return <PersonnalisationTab />;
      case 'invoice-design':
        return (
          <InvoiceDesignTab
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        );
      case 'clients':
        return <ClientsSection />;
      case 'services':
        return <ServicesTab />;
      case 'quote-templates':
        return <QuoteTemplatesTab />;
      case 'statuses':
        return <StatusesSection />;
      case 'smtp':
        return (
          <SmtpSection
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        );
      case 'emails':
        return (
          <EmailsSection
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        );
      case 'reminders':
        return (
          <RemindersSection
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        );
      case 'abaninja':
        return (
          <AbaNinjaSection
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        );
      case 'cms':
        return (
          <CmsSection
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        );
      case 'bank':
        return <BankSection />;
      case 'bank-accounts':
        return user?.hasComptaPlus ? <BankAccountsSection /> : <UpgradePrompt feature="Les comptes bancaires multiples" />;
      case 'expense-categories':
        return user?.hasComptaPlus ? <ExpenseCategoriesSection /> : <UpgradePrompt feature="Les catégories de dépenses" />;
      case 'counterparty-rules':
        return user?.hasComptaPlus ? <CounterpartyRulesSection /> : <UpgradePrompt feature="Les règles fournisseurs" />;
      default:
        return (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">
              Section non trouvée
            </p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Paramètres
        </h1>
      </div>

      <SettingsLayout
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      >
        {renderSection()}
      </SettingsLayout>
    </div>
  );
}
