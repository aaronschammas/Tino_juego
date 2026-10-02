import Card from '@/components/ui/Card';
import StatBox from '@/components/ui/StatBox';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/cn';
import { memo } from 'react';

interface ProgressRow {
  label: string;
  value: number;
  share: number;
  toneClass: string;
}

interface TrendCardProps {
  progressRows: ProgressRow[];
  totalTasks: number;
  completionRate: number;
  timeWorkedLabel: string;
}

const colorMap: Record<string, string> = {
  'bg-[var(--color-primary-600)]': 'var(--color-primary-600)',
  'bg-[var(--color-secondary-600)]': 'var(--color-secondary-600)',
  'bg-[var(--color-accent-600)]': 'var(--color-accent-600)',
  'bg-[var(--color-ink-400)]': 'var(--color-ink-400)',
};

const TrendCard = ({
  progressRows,
  totalTasks,
  completionRate,
  timeWorkedLabel,
}: TrendCardProps) => {
  const data = progressRows.filter(row => row.value > 0).map(row => ({
    name: row.label,
    value: row.value,
    color: colorMap[row.toneClass] || 'var(--color-ink-400)',
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="col-span-1 xl:col-span-2 space-y-5 p-6 bg-white dark:bg-[var(--color-surface-card)] shadow-lg rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">Distribución del Trabajo</h2>
            <p className="text-sm text-[var(--color-ink-500)]">
              Estado actual de las tareas en el ciclo de vida del proyecto.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
          <div className="w-[200px] h-[200px] min-w-0 shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0} debounce={100}>
              <PieChart>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ fontWeight: 600 }}
                />
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center text in Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-[var(--color-ink-900)]">{completionRate}%</span>
              <span className="text-xs text-[var(--color-ink-500)]">Completado</span>
            </div>
          </div>
          
          <div className="flex-1 w-full space-y-4">
            {progressRows.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[item.toneClass] || 'var(--color-ink-400)' }} />
                    <span className="font-medium text-[var(--color-ink-700)]">{item.label}</span>
                  </div>
                  <span className="font-semibold text-[var(--color-ink-900)]">
                    {item.value} <span className="text-[var(--color-ink-400)] font-normal ml-1">({item.share}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-ink-100)] overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', item.toneClass)} style={{ width: `${item.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="col-span-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <StatBox
          label="Total de tareas"
          value={totalTasks}
          meta="Base total del analisis"
          tone="neutral"
        />
        <StatBox
          label="Tiempo trabajado"
          value={timeWorkedLabel}
          meta="Tiempo acumulado en el periodo"
          tone="primary"
        />
      </div>
    </div>
  );
};

export default memo(TrendCard);
