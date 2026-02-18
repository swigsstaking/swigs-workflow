import SettingsNav from './SettingsNav';

export default function SettingsLayout({ activeSection, onSectionChange, children }) {
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar - Desktop */}
      <div className="lg:w-56 lg:flex-shrink-0">
        <div className="lg:sticky lg:top-6">
          <SettingsNav
            activeSection={activeSection}
            onSectionChange={onSectionChange}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div
          className="transition-opacity duration-150"
          key={activeSection}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
