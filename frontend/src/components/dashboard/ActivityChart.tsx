import { useMemo } from 'react';
import Card from '@/components/ui/Card';
import { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface ActivityChartProps {
  className?: string;
}

const ActivityChart = ({ className }: ActivityChartProps) => {
  // Datos mock para el gráfico de "Tendencia y Progreso" ya que la API solo devuelve agregados.
  const data = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      result.push({
        name: date.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'America/Argentina/Buenos_Aires' }),
        actividad: Math.floor(Math.random() * 50) + 10,
      });
    }
    return result;
  }, []);

  return (
    <Card hoverable className={`p-6 ${className}`}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="app-section-title">Tendencia y Progreso</h3>
          <p className="app-body text-[13px]">Actividad de tareas en la última semana</p>
        </div>
        <div className="flex gap-1.5 bg-[var(--color-surface-2)] p-1 rounded-[var(--radius-md)]">
          <button className="text-[12px] font-semibold text-[var(--color-primary-fg)] bg-[var(--color-primary)] px-3 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] transition-all">Día</button>
          <button className="text-[12px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-3 py-1 transition-all">Semana</button>
          <button className="text-[12px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-3 py-1 transition-all">Mes</button>
        </div>
      </div>

      <div className="h-[250px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={250} minWidth={0} debounce={100}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActividad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-subtle)' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-subtle)' }} />
            <Tooltip 
              contentStyle={{ 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--color-border)', 
                boxShadow: 'var(--shadow-md)',
                fontSize: '12px'
              }}
              itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
            />
            <Area 
              type="monotone" 
              dataKey="actividad" 
              stroke="var(--color-primary)" 
              strokeWidth={2.5}
              fillOpacity={1} 
              fill="url(#colorActividad)" 
              activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-primary)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default memo(ActivityChart);
