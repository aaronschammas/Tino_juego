'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock3, Home, ListTodo, MessageCircle, PieChart } from 'lucide-react';

const items = [
  { href: '/mobile', label: 'Inicio', icon: Home },
  { href: '/mobile/tasks', label: 'Tareas', icon: ListTodo },
  { href: '/mobile/time', label: 'Tiempo', icon: Clock3 },
  { href: '/mobile/assistant', label: 'Consultas', icon: MessageCircle },
  { href: '/mobile/summary', label: 'Resumen', icon: PieChart },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegacion movil principal">
      <div className="mobile-bottom-nav-inner mobile-bottom-nav-five">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/mobile' ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="mobile-nav-link" aria-current={active ? 'page' : undefined}>
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
