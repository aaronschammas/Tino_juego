import { memo } from 'react';
import { Plus, Download, FileText } from 'lucide-react';

interface DashboardHeaderProps {
  title: string;
  description: string;
  organizationName?: string | null;
  onNewTask?: () => void;
  onOpenReport?: () => void;
}

const DashboardHeader = ({
  title,
  description,
  organizationName,
  onNewTask,
  onOpenReport,
}: DashboardHeaderProps) => {
  const organizationLabel = organizationName?.trim() || 'WORKSPACE';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="max-w-[min(100%,42rem)] truncate text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
            {organizationLabel}
          </p>
          <h1 className="text-[32px] md:text-[40px] font-extrabold tracking-tight text-slate-900 leading-none mb-3">
            {title}
          </h1>
          <p className="text-[15px] text-slate-500 font-medium">
            {description}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button className="hidden items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-slate-500 hover:text-slate-900 transition-colors">
            <Download size={18} />
            Exportar
          </button>
          <button
            onClick={onOpenReport}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 border border-slate-200 bg-white text-[#1e3a5f] px-5 py-3.5 rounded-2xl text-[14px] font-bold shadow-sm hover:bg-slate-50 transition-all"
          >
            <FileText size={18} />
            Exportar informe
          </button>
          <button 
            onClick={onNewTask}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-[#1e3a5f] text-white px-6 py-3.5 rounded-2xl text-[14px] font-bold shadow-lg shadow-blue-900/10 hover:bg-[#2c4f7c] transition-all"
          >
            <Plus size={18} />
            Nueva tarea
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(DashboardHeader);
