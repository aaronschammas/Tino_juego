import React, { memo, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '@/components/ui/Card';
import { DashboardTasksResponse } from '@/types/analytics';
import { taskStatusLabels } from '@/types/task';
import { Activity } from 'lucide-react';

interface Props {
  data: DashboardTasksResponse['statusDistribution'];
  className?: string;
}

// Mapa de colores semánticos por estado de tarea
const statusColorMap: Record<string, string> = {
  TODO: '#94a3b8', // Gris suave
  IN_PROGRESS: '#3b82f6', // Azul de Tino (var(--color-info))
  BLOCKED: '#f59e0b', // Naranja suave (var(--color-warn))
  DONE: '#10b981', // Verde de éxito (var(--color-success))
};

const BurndownChart = ({ data, className = '' }: Props) => {
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        statusKey: item.status, // Conservar la clave original
        status: taskStatusLabels[item.status] ?? item.status,
        Tareas: item.count,
      })),
    [data],
  );

  return (
    <Card className={`p-6 shadow-sm border-gray-100 flex flex-col ${className}`}>
      <div className="mb-6">
        <h3 className="text-[16px] font-bold text-gray-900">Distribución de tareas</h3>
        <p className="text-[13px] text-gray-500 font-medium">Estado actual del trabajo seleccionado</p>
      </div>

      <div className="w-full h-[300px] min-w-0 relative">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-10 h-full">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Activity className="text-gray-300" size={32} />
            </div>
            <h4 className="text-[16px] font-bold text-gray-900 mb-1">Aún no hay tareas para mostrar</h4>
            <p className="text-[13px] text-gray-500 max-w-[260px]">
              Ajustá los filtros o creá tareas para ver la distribución.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={300} debounce={100}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="Tareas" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColorMap[entry.statusKey] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};

export default memo(BurndownChart);
