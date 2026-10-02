import React, { memo, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { DashboardPriority } from '@/types/analytics';
import { ShieldAlert } from 'lucide-react';

interface Props {
  data: Array<{ priority: DashboardPriority; count: number }>;
  className?: string;
}

const priorityLabels: Record<DashboardPriority, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

const priorityColorMap: Record<DashboardPriority, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-amber-500',
  MEDIUM: 'bg-sky-500',
  LOW: 'bg-slate-400',
};

const priorityBadgeMap: Record<DashboardPriority, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-100',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-100',
  MEDIUM: 'bg-sky-50 text-sky-700 border-sky-100',
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
};

const PriorityDistributionChart = ({ data, className = '' }: Props) => {
  // Asegurar orden consistente: Crítica, Alta, Media, Baja
  const order: DashboardPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  
  const { distributionMap, total } = useMemo(
    () => ({
      distributionMap: new Map(data.map(item => [item.priority, item.count])),
      total: data.reduce((sum, item) => sum + item.count, 0),
    }),
    [data],
  );

  return (
    <Card className={`p-6 shadow-sm border-gray-100 flex flex-col ${className}`}>
      <div className="mb-6">
        <h3 className="text-[16px] font-bold text-gray-900">Distribución por prioridad</h3>
        <p className="text-[13px] text-gray-500 font-medium">Gravedad y nivel de atención requerido</p>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-5">
        {total === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 text-gray-400">
            <ShieldAlert size={28} className="text-slate-300 mb-2" />
            <span className="text-sm font-medium">No hay tareas con prioridad definida.</span>
          </div>
        ) : (
          order.map((priority) => {
            const count = distributionMap.get(priority) ?? 0;
            const percent = total > 0 ? (count / total) * 100 : 0;
            const colorClass = priorityColorMap[priority];
            const badgeClass = priorityBadgeMap[priority];

            return (
              <div key={priority} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
                    <span className="text-slate-700">{priorityLabels[priority]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${badgeClass}`}>
                      {count} {count === 1 ? 'tarea' : 'tareas'}
                    </span>
                    <span className="text-slate-400 font-bold w-8 text-right">{percent.toFixed(0)}%</span>
                  </div>
                </div>
                
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default memo(PriorityDistributionChart);
