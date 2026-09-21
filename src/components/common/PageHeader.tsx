import React from 'react';
import { Breadcrumb, BreadcrumbItem } from './Breadcrumb';

interface ActionButton {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  id?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  badgeColor?: 'blue' | 'emerald' | 'amber' | 'slate' | 'indigo' | 'purple' | 'rose';
  breadcrumbItems: BreadcrumbItem[];
  actions?: ActionButton[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  badgeColor = 'blue',
  breadcrumbItems,
  actions = [],
}) => {
  const getBadgeClass = () => {
    switch (badgeColor) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'slate':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getButtonClass = (variant: ActionButton['variant'] = 'primary') => {
    switch (variant) {
      case 'secondary':
        return 'bg-slate-800 hover:bg-slate-900 text-white border-transparent';
      case 'outline':
        return 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300';
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white border-transparent';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-xs';
    }
  };

  return (
    <div className="mb-6">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {badge !== undefined && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeClass()}`}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action, idx) => (
              <button
                key={idx}
                id={action.id}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${getButtonClass(
                  action.variant
                )}`}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
