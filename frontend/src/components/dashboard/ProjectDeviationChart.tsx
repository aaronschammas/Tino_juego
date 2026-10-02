import React, { memo } from 'react';
import Card from '@/components/ui/Card';
import { DashboardProjectsResponse } from '@/types/analytics';
import { AlertCircle } from 'lucide-react';

interface Props {
  data: DashboardProjectsResponse | null;
  className?: string;
}

const ProjectDeviationChart = ({ data, className = '' }: Props) => {
  const projects = data?.projects ?? [];

  return (
    <Card className={`p-6 shadow-sm border-gray-100 flex flex-col ${className}`}>
      <div className="mb-6">
        <h3 className="text-[16px] font-bold text-gray-900">Desvío de esfuerzo por proyecto</h3>
        <p className="text-[13px] text-gray-500 font-medium">
          Planificado (estimado) versus tiempo real registrado
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto max-h-[350px] pr-1">
        {projects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 text-gray-400">
            <AlertCircle size={28} className="text-slate-300 mb-2" />
            <span className="text-sm font-medium">No hay datos de proyectos para este rango.</span>
          </div>
        ) : (
          projects.map((proj) => {
            const hasDeviation = proj.deviationHours !== 0;
            const isOver = proj.deviationHours > 0;
            
            // Formatear desvío
            const absDeviation = Math.abs(proj.deviationHours).toFixed(1);
            const deviationPercentText = proj.deviationPercent !== null 
              ? `${Math.abs(proj.deviationPercent).toFixed(0)}%` 
              : '0%';
            
            const deviationText = isOver 
              ? `+${absDeviation}h (+${deviationPercentText})`
              : `-${absDeviation}h (-${deviationPercentText})`;

            // Calcular porcentajes relativos para barras de progreso (comparando entre Estimado y Real de cada proyecto)
            const maxVal = Math.max(proj.estimatedHours, proj.actualHours);
            const estPercent = maxVal > 0 ? (proj.estimatedHours / maxVal) * 100 : 0;
            const actPercent = maxVal > 0 ? (proj.actualHours / maxVal) * 100 : 0;

            return (
              <div key={proj.projectId} className="space-y-2.5 border-b border-slate-100/60 pb-5 last:border-b-0 last:pb-0">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 leading-tight">{proj.projectName}</h4>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1">
                      Estimado: <span className="font-bold text-slate-600">{proj.estimatedHours.toFixed(1)}h</span> · 
                      Real: <span className="font-bold text-slate-600">{proj.actualHours.toFixed(1)}h</span>
                    </p>
                  </div>
                  {hasDeviation ? (
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 ${
                      isOver 
                        ? 'bg-red-50 text-red-600 border border-red-100' 
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {deviationText}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl shrink-0 bg-slate-50 text-slate-500 border border-slate-100">
                      Sin desvío
                    </span>
                  )}
                </div>

                {/* Barras de progreso horizontal comparativas */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 w-8 tracking-wider">EST.</span>
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-slate-300 h-full rounded-full transition-all duration-300" 
                        style={{ width: `${estPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 w-8 tracking-wider">REAL</span>
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver ? 'bg-red-400' : 'bg-emerald-400'
                        }`} 
                        style={{ width: `${actPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default memo(ProjectDeviationChart);
