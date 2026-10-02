'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Proyectos',
  users: 'Usuarios',
  profile: 'Perfil',
  organizations: 'Organizaciones',
  analytics: 'Analitica',
};

export default function Breadcrumb() {
  const pathname = usePathname() || '';
  const paths = pathname.split('/').filter(Boolean);
  const { projects } = useProjects();

  if (paths.length === 0) return null;

  return (
    <nav className="hidden mb-4 items-center gap-1.5 text-[12.5px] text-[var(--color-text-muted)]">
      <Link 
        href="/dashboard" 
        className="flex items-center gap-1 transition-colors hover:text-[var(--color-text)]"
      >
        <Home size={14} />
      </Link>
      
      {paths.map((path, index) => {
        const href = `/${paths.slice(0, index + 1).join('/')}`;
        const isLast = index === paths.length - 1;
        
        // Detectar si estamos en un ID de proyecto
        let label = routeLabels[path];
        
        if (!label && index > 0 && paths[index - 1] === 'projects') {
          const project = projects.find(p => p.id === path);
          if (project) {
            label = project.name;
          }
        }

        if (!label) label = path;

        return (
          <div key={href} className="flex items-center gap-1.5">
            <ChevronRight size={14} className="text-[var(--color-text-subtle)]" />
            {isLast ? (
              <span className="font-medium text-[var(--color-text)]">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="transition-colors hover:text-[var(--color-text)]"
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
