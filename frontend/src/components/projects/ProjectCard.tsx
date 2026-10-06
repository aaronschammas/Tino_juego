import { Project } from '@/types/project';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { formatDateUTC } from '@/lib/time';
import { cn } from '@/lib/cn';
import { Calendar, CheckSquare, Edit3, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (id: string) => void;
  /** Proyecto de la última partida del juego de la feria: se resalta para que el visitante explore sus métricas. */
  isLastGame?: boolean;
}

const priorityColors = {
  LOW: 'bg-gray-50 text-gray-400 border-gray-100',
  MEDIUM: 'bg-[#e8eef5] text-[#1e3a5f] border-[#1e3a5f]/10',
  HIGH: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
  CRITICAL: 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]',
};

const priorityLabels = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Critica',
};

export default function ProjectCard({ project, onEdit, onDelete, isLastGame = false }: ProjectCardProps) {
  const tasks = project.tasks || [];
  const totalTasks = project.taskStats?.total ?? tasks.length;
  const completedTasks = project.taskStats?.completed ?? tasks.filter((task) => task.status === 'DONE').length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Card
      className={cn(
        'group relative border-slate-100 shadow-sm hover:shadow-md transition-all p-7 rounded-[32px] bg-white overflow-hidden',
        isLastGame && 'ring-4 ring-orange-400',
      )}
    >
      {isLastGame ? (
        <span className="mb-3 inline-flex rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">
          Tu última partida · mirá sus métricas
        </span>
      ) : null}
      <Link href={`/projects/${project.id}`} className="block">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1 pr-4">
            <h3 className="text-[20px] font-extrabold text-slate-900 tracking-tight line-clamp-1 group-hover:text-[#1e3a5f] transition-colors">
              {project.name}
            </h3>
            <p className="text-[14px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
              {project.description || 'Sin descripcion detallada'}
            </p>
          </div>
          <div className={cn(
            "shrink-0 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border",
            priorityColors[project.priority]
          )}>
            {priorityLabels[project.priority]}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-8 text-[13px] font-bold text-slate-400">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", project.isActive ? "bg-green-500" : "bg-slate-300")} />
            <span className="text-slate-600">{project.isActive ? 'Activo' : 'Pausado'}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-slate-300" />
            <span className="text-slate-600">{totalTasks} tarea{totalTasks !== 1 ? 's' : ''}</span>
          </div>
          {project.dueDate && (
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-300" />
              <span className="text-slate-600">Entrega {formatDateUTC(project.dueDate)}</span>
            </div>
          )}
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">PROGRESO</span>
            <span className="text-[15px] font-black text-slate-900">{progress}%</span>
          </div>
          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#1e3a5f] rounded-full transition-all duration-1000 ease-out shadow-sm" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-center gap-8 pt-6 border-t border-slate-50 mt-auto">
        {onEdit && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(project);
            }}
            className="flex items-center gap-2 text-[14px] font-bold text-slate-500 hover:text-[#1e3a5f] transition-all"
          >
            <Edit3 size={16} />
            Editar
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(project.id);
            }}
            className="flex items-center gap-2 text-[14px] font-bold text-slate-500 hover:text-red-600 transition-all"
          >
            <Trash2 size={16} />
            Eliminar
          </button>
        )}
      </div>
    </Card>
  );
}
