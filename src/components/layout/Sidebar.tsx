import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  DoorOpen,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Settings,
  GraduationCap,
  X,
  Database,
  AlertCircle,
  FileUp,
  FileDown,
  UserCheck,
  Printer,
} from 'lucide-react';
import { MenuItemId } from '../../types/database';
import { useData } from '../../context/DataContext';

interface SidebarProps {
  currentMenu: MenuItemId;
  onSelectMenu: (menu: MenuItemId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: MenuItemId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  category?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentMenu,
  onSelectMenu,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { conflicts } = useData();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'teachers', label: 'Data Guru', icon: Users, category: 'Master Data' },
    { id: 'buildings', label: 'Data Gedung', icon: Building2, category: 'Master Data' },
    { id: 'rooms', label: 'Ruang', icon: DoorOpen, category: 'Master Data' },
    { id: 'subjects', label: 'Mata Pelajaran', icon: BookOpen, category: 'Master Data' },
    { id: 'exam_schedules', label: 'Jadwal Ujian', icon: CalendarDays, category: 'Jadwal & Pengawasan' },
    {
      id: 'invigilator_schedules',
      label: 'Jadwal Pengawas',
      icon: ClipboardList,
      category: 'Jadwal & Pengawasan',
      badgeCount: conflicts.length > 0 ? conflicts.length : undefined,
    },
    {
      id: 'attendance',
      label: 'Kehadiran & Bendahara',
      icon: UserCheck,
      category: 'Jadwal & Pengawasan',
    },
    { id: 'print_center', label: 'Pusat Cetak Ujian', icon: Printer, category: 'Pusat Berkas & Alat' },
    { id: 'import_center', label: 'Import Data', icon: FileUp, category: 'Pusat Berkas & Alat' },
    { id: 'export_center', label: 'Export Data', icon: FileDown, category: 'Pusat Berkas & Alat' },
    { id: 'settings', label: 'Pengaturan', icon: Settings, category: 'Sistem' },
  ];

  const handleSelect = (id: MenuItemId) => {
    onSelectMenu(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-800 shadow-xl`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-black tracking-wide text-white uppercase leading-snug">
                Manajemen Ujian
              </h1>
              <p className="text-[11px] text-blue-200 font-medium truncate leading-tight">
                SMP Bhinneka Tunggal Ika
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentMenu === item.id;
            const showCategoryHeader =
              item.category &&
              (index === 0 || navItems[index - 1].category !== item.category);

            return (
              <React.Fragment key={item.id}>
                {showCategoryHeader && (
                  <div className="pt-3.5 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {item.category}
                  </div>
                )}
                <button
                  id={`sidebar-nav-${item.id}`}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badgeCount !== undefined && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950">
                      <AlertCircle className="w-2.5 h-2.5" />
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Supabase PostgreSQL</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Sistem Panitia Ujian Sekolah &bull; 2024/2025
          </p>
        </div>
      </aside>
    </>
  );
};
