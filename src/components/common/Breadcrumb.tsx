import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-3" aria-label="Breadcrumb">
      <div className="flex items-center gap-1 text-slate-400">
        <Home className="w-3.5 h-3.5" />
        <span>Beranda</span>
      </div>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-slate-800" aria-current="page">
                {item.label}
              </span>
            ) : item.onClick ? (
              <button
                onClick={item.onClick}
                className="hover:text-blue-600 transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <span>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
