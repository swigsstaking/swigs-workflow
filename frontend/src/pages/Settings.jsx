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
import StatusesSection from '../components/Settings/sections/StatusesSection';
import SmtpSection from '../components/Settings/sections/SmtpSection';
import EmailsSection from '../components/Settings/sections/EmailsSection';
import RemindersSection from '../components/Settings/sections/RemindersSection';
import AbaNinjaSection from '../components/Settings/sections/AbaNinjaSection';
import CmsSection from '../components/Settings/sections/CmsSection';
import BankSection from '../components/Settings/sections/BankSection';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

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
      case 'personalization':
        return <PersonnalisationTab />;
      case 'clients':
        return <ClientsSection />;
      case 'services':
        return <ServicesTab />;
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
