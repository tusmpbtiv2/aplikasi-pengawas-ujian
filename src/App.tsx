import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { MenuItemId } from './types/database';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AuthModal } from './components/auth/AuthModal';

// Views
import { DashboardView } from './components/views/DashboardView';
import { TeachersView } from './components/views/TeachersView';
import { BuildingsView } from './components/views/BuildingsView';
import { RoomsView } from './components/views/RoomsView';
import { SubjectsView } from './components/views/SubjectsView';
import { ExamSchedulesView } from './components/views/ExamSchedulesView';
import { InvigilatorSchedulesView } from './components/views/InvigilatorSchedulesView';
import { AttendanceView } from './components/views/AttendanceView';
import { PrintCenterView } from './components/views/PrintCenterView';
import { ImportCenterView } from './components/views/ImportCenterView';
import { ExportCenterView } from './components/views/ExportCenterView';
import { SettingsView } from './components/views/SettingsView';

const MainLayout: React.FC = () => {
  const [currentMenu, setCurrentMenu] = useState<MenuItemId>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const renderCurrentView = () => {
    switch (currentMenu) {
      case 'dashboard':
        return <DashboardView onNavigate={(menu) => setCurrentMenu(menu)} />;
      case 'teachers':
        return <TeachersView />;
      case 'buildings':
        return <BuildingsView />;
      case 'rooms':
        return <RoomsView />;
      case 'subjects':
        return <SubjectsView />;
      case 'exam_schedules':
        return <ExamSchedulesView onNavigate={(menu) => setCurrentMenu(menu)} />;
      case 'invigilator_schedules':
        return <InvigilatorSchedulesView />;
      case 'attendance':
        return <AttendanceView />;
      case 'print_center':
        return <PrintCenterView />;
      case 'import_center':
        return <ImportCenterView />;
      case 'export_center':
        return <ExportCenterView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={(menu) => setCurrentMenu(menu)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col antialiased text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentMenu={currentMenu}
        onSelectMenu={(menu) => setCurrentMenu(menu)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Header
          currentMenu={currentMenu}
          onOpenMobile={() => setIsMobileSidebarOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSelectMenu={(menu) => setCurrentMenu(menu)}
        />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {renderCurrentView()}
        </main>

        <footer className="py-4 px-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white/50">
          Sistem Manajemen Ujian Sekolah &bull; SMP Bhinneka Tunggal Ika &bull; Hak Cipta &copy; {new Date().getFullYear()}
        </footer>
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoToSettings={() => {
          setIsAuthModalOpen(false);
          setCurrentMenu('settings');
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>
          <MainLayout />
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}
