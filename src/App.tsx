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
  const [currentMenu, setCurrentMenu] = useState<MenuItemId>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const menu = params.get('menu');
      if (
        menu &&
        [
          'dashboard',
          'teachers',
          'buildings',
          'rooms',
          'subjects',
          'exam_schedules',
          'invigilator_schedules',
          'attendance',
          'print_center',
          'import_center',
          'export_center',
          'settings',
        ].includes(menu)
      ) {
        return menu as MenuItemId;
      }
    } catch (e) {
      // fallback
    }
    return 'dashboard';
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const isPrintOnly = React.useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('print_only') === 'true';
    } catch (e) {
      return false;
    }
  }, []);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autoPrint') === 'true') {
        const timer = setTimeout(() => {
          window.print();
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // ignore
    }
  }, []);

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

  if (isPrintOnly) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <div className="print:hidden bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold">Mode Cetak Standalone (Bebas Batasan Iframe)</span>
            <span className="text-[11px] text-slate-300 hidden sm:inline">&bull; Siap dicetak langsung atau disimpan ke format PDF</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              Cetak / Simpan PDF
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium cursor-pointer"
            >
              Tutup Tab
            </button>
          </div>
        </div>
        <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {renderCurrentView()}
        </main>
      </div>
    );
  }

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
