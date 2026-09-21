import React from 'react';
import { FolderOpen, Plus, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface EmptyStateProps {
  title: string;
  description: string;
  onAdd?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  onAdd,
  onAction,
  actionLabel = 'Tambah Data',
  icon,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const handleAction = onAction || onAdd;

  const renderIcon = () => {
    if (!icon) return <FolderOpen className="w-7 h-7 stroke-[1.5]" />;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as React.ComponentType<{ className?: string }>;
    return <IconComp className="w-7 h-7 stroke-[1.5]" />;
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs my-4">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
        {renderIcon()}
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>

      {handleAction && (
        <div className="mt-6">
          {isAdmin ? (
            <button
              id="empty-state-add-btn"
              onClick={handleAction}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              {actionLabel}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-md border border-slate-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              Mode Viewer: Data hanya dapat ditambahkan oleh Admin
            </div>
          )}
        </div>
      )}
    </div>
  );
};
