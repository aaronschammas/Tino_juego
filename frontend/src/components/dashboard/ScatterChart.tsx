import React, { memo } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import Card from '@/components/ui/Card';
import { DashboardTimeTask } from '@/types/analytics';

interface Props {
  data: DashboardTimeTask[];
  className?: string;
  onTaskClick?: (task: DashboardTimeTask) => void;
}

interface ChartPoint {
  id: string;
  name: string;
  estimated: number;
  actual: number;
}

function EffortTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100 text-sm">
      <p className="font-medium text-gray-900 mb-1">{item.name}</p>
      <p className="text-gray-600">Estimado: <span className="font-semibold">{item.estimated}h</span></p>
      <p className="text-gray-600">Real: <span className="font-semibold">{item.actual}h</span></p>
    </div>
  );
}

const ScatterChart = ({ data, className = '', onTaskClick }: Props) => {
  const chartData = data
    .filter((task) => task.estimatedHours > 0 || task.actualHours > 0)
    .map((task) => ({
      id: task.taskId,
      name: task.title,
      estimated: task.estimatedHours,
      actual: task.actualHours,
    }));

  return (
    <Card className={`p-6 shadow-sm border-gray-100 flex flex-col ${className}`}>
      <div className="mb-6">
        <h3 className="text-[16px] font-bold text-gray-900">Relación de esfuerzo</h3>
        <p className="text-[13px] text-gray-500 font-medium">Tareas con mayor desvío estimado vs. real</p>
      </div>

      <div className="w-full h-[300px] min-w-0 relative">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            No hay datos de estimación o tiempo
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={300} debounce={100}>
            <RechartsScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" dataKey="estimated" name="Estimado (h)" unit="h" stroke="#888888" fontSize={12} tickLine={false} />
              <YAxis type="number" dataKey="actual" name="Real (h)" unit="h" stroke="#888888" fontSize={12} tickLine={false} />
              <ZAxis type="number" range={[100, 100]} />
              <Tooltip content={<EffortTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter
                name="Tareas"
                data={chartData}
                fill="var(--color-primary-500)"
                onClick={(point: unknown) => {
                  const clicked = point as { id?: string };
                  const task = data.find((item) => item.taskId === clicked.id);
                  if (task) onTaskClick?.(task);
                }}
                className="cursor-pointer"
              />
            </RechartsScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};

export default memo(ScatterChart);
