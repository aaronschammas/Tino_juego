import { OverviewAnalytics } from '@/types/analytics';
import StatCard from './StatCard';

interface OverviewCardsProps {
  data: OverviewAnalytics;
}

export default function OverviewCards({ data }: OverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total de tareas" value={data.totalTasks} color="blue" />
      <StatCard title="Tareas completadas" value={data.completedTasks} color="green" />
      <StatCard title="En progreso" value={data.tasksInProgress} color="orange" />
      <StatCard title="Tasa de completado" value={`${data.completionRate}%`} color="purple" />
      <StatCard title="Tareas bloqueadas" value={data.blockedTasks} color="red" />
      <StatCard title="Tareas vencidas" value={data.overdueTasks} color="red" />
      <StatCard title="Horas trabajadas" value={`${data.totalHoursWorked}h`} color="blue" />
      <StatCard title="Tareas pendientes" value={data.totalTasks - data.completedTasks} color="orange" />
    </div>
  );
}
