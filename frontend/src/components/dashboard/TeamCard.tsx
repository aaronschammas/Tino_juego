import Card from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { memo } from 'react';

interface TeamMemberListItem {
  id: string;
  name: string;
  email: string;
  statusLabel: string;
  initials: string;
}

interface TeamTableMember {
  userId: string;
  name: string;
  email: string;
  totalHours: number;
  tasksCompleted: number;
}

interface TeamCardProps {
  title: string;
  description: string;
  listMembers?: TeamMemberListItem[];
  tableMembers?: TeamTableMember[];
  emptyLabel: string;
  avatarPalette: string[];
}

const TeamCard = ({
  title,
  description,
  listMembers,
  tableMembers,
  emptyLabel,
  avatarPalette,
}: TeamCardProps) => {
  
  // Normalizar los miembros para usar un solo layout de tarjeta
  const normalizedMembers = listMembers 
    ? listMembers.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        initials: m.initials,
        metricLabel: m.statusLabel,
        metricValue: 100, // placeholder
        showProgress: false
      }))
    : tableMembers
    ? tableMembers.map(m => {
        // Encontrar el valor maximo para la barra de progreso
        const maxTasks = Math.max(...tableMembers.map(tm => tm.tasksCompleted), 1);
        const progress = (m.tasksCompleted / maxTasks) * 100;
        
        // Extraer iniciales
        const names = m.name.split(' ');
        const initials = names.length > 1 
          ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
          : m.name.substring(0, 2).toUpperCase();

        return {
          id: m.userId,
          name: m.name,
          email: m.email,
          initials,
          metricLabel: `${m.tasksCompleted} tareas | ${m.totalHours}h`,
          metricValue: progress,
          showProgress: true
        };
      })
    : [];

  return (
    <Card className="space-y-6 p-6 bg-white dark:bg-[var(--color-surface-card)] shadow-lg rounded-2xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">{title}</h2>
          <p className="text-sm text-[var(--color-ink-500)]">{description}</p>
        </div>
      </div>

      {normalizedMembers.length > 0 ? (
        <div className="space-y-4 max-h-[400px] overflow-y-auto app-scrollbar pr-2">
          {normalizedMembers.map((member, index) => (
            <div key={member.id} className="group relative rounded-xl border border-[var(--color-ink-100)] hover:border-[var(--color-primary-200)] bg-white dark:bg-[var(--color-ink-050)] p-4 transition-all hover:shadow-sm">
              <div className="flex items-center gap-4">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm', avatarPalette[index % avatarPalette.length])}>
                  {member.initials}
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="truncate text-sm font-semibold text-[var(--color-ink-900)] group-hover:text-[var(--color-primary-700)] transition-colors">{member.name}</p>
                    <span className="text-xs font-medium text-[var(--color-ink-600)]">{member.metricLabel}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <p className="truncate text-xs text-[var(--color-ink-500)] w-24 hidden sm:block">{member.email}</p>
                    
                    {member.showProgress && (
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-ink-100)] overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-[var(--color-primary-600)] transition-all duration-1000 ease-out" 
                          style={{ width: `${member.metricValue}%` }} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-[var(--color-ink-200)] bg-[var(--color-ink-050)] p-8 text-center">
          <p className="app-body">{emptyLabel}</p>
        </div>
      )}
    </Card>
  );
};

export default memo(TeamCard);
