'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin, isSuperAdmin } from '@/lib/auth';
import BrandMark from '@/components/brand/BrandMark';
import { cn } from '@/lib/cn';
import { formatUserDisplayName } from '@/lib/user-display';
import { LayoutDashboard, Folder, Users, User, Trash2, Star, LogOut, ChevronDown, Menu, X, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const {
    user,
    logout,
    activeOrganization,
    activeMembership,
    memberships = [],
    switchOrganization,
    isSwitchingOrganization,
    organizationSwitchError,
  } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMenuClosing, setIsMobileMenuClosing] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileSidebarRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/projects', label: 'Proyectos', icon: Folder },
    { href: '/users', label: 'Usuarios', icon: Users },
  ];

  if (isSuperAdmin(user)) {
    navItems.push({ href: '/admin-panel', label: 'Administración', icon: ShieldCheck });
  }

  const isActive = (href: string) => pathname === href;
  const userDisplayName = formatUserDisplayName(user?.name, user?.lastname) || user?.email || 'Usuario';
  const userInitials = userDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const activePlanName = typeof activeOrganization?.plan === 'string'
    ? activeOrganization.plan
    : activeOrganization?.plan?.title || activeOrganization?.plan?.name;
  const activeOrgRole = activeMembership?.role === 'ORG_OWNER' ? 'Propietario' : 'Miembro';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCloseMobileMenu = () => {
    setIsMobileMenuClosing(true);
    setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsMobileMenuClosing(false);
    }, 600); // Darle tiempo a la animacion para terminar
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[var(--header-height)] border-b border-slate-100 bg-white">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-3 md:px-8 gap-4">
        
        {/* Left Side: Burger (mobile) + Logo */}
        <div className="flex items-center gap-4 md:gap-8">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Menu size={24} />
          </button>
          
          <BrandMark href="/dashboard" compact />

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-2.5 rounded-lg px-4 py-2 text-[13.5px] font-bold transition-all duration-150',
                    active
                      ? 'bg-[#1e3a5f] text-white shadow-lg shadow-blue-900/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <Icon size={18} className={active ? 'text-white' : 'text-slate-400'} />
                  <span className={active ? 'text-white' : 'text-slate-600'}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Side: User Avatar/Menu */}
        <div className="flex items-center gap-2 relative" ref={userMenuRef}>
          {activeOrganization && (
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              {memberships.length > 1 ? (
                <select
                  value={activeOrganization.id}
                  onChange={(event) => {
                    void switchOrganization(event.target.value).catch(() => undefined);
                  }}
                  disabled={isSwitchingOrganization}
                  className="max-w-[180px] bg-transparent text-[12px] font-bold text-slate-800 outline-none"
                  aria-label="Organizacion activa"
                >
                  {memberships.map((membership) => (
                    <option key={membership.organizationId} value={membership.organizationId}>
                      {membership.organizationName}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="max-w-[180px] truncate text-[12px] font-bold text-slate-800">
                  {activeOrganization.name}
                </span>
              )}
              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                {activePlanName || 'Sin plan'}
              </span>
              {organizationSwitchError ? (
                <span className="max-w-[220px] text-[11px] font-semibold text-red-600" role="alert">
                  {organizationSwitchError}
                </span>
              ) : null}
            </div>
          )}
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-lg shadow-blue-900/10">
              {userInitials}
            </div>
            <div className="hidden md:flex flex-col items-start leading-tight">
              <span className="text-[13px] font-bold text-gray-900">
                {userDisplayName}
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                {isSuperAdmin(user) ? 'Super Admin' : activeMembership ? activeOrgRole : isAdmin(user) ? 'Administrador' : 'Miembro'}
              </span>
            </div>
            <ChevronDown size={16} className={cn("hidden md:block text-gray-400 transition-transform duration-200", isUserMenuOpen && "rotate-180")} />
          </button>

          {/* User Menu Modal/Dropdown (Shared Desktop & Mobile) */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-[24px] border border-slate-100 bg-white p-2 shadow-[0_25px_50px_-12px_rgba(30,58,95,0.25)] animate-page-enter">
              {/* User Header */}
              <div className="flex items-center gap-4 p-4 border-b border-slate-50 mb-1">
                <div className="w-12 h-12 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-[14px] font-bold shrink-0">
                  {userInitials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-bold text-gray-900 truncate">
                    {userDisplayName}
                  </span>
                  <span className="text-[12px] text-slate-400 font-medium truncate">
                    {user?.email}
                  </span>
                </div>
              </div>

              {/* Menu Links */}
              {activeOrganization && (
                <div className="space-y-2 border-b border-slate-50 px-2 pb-3 mb-1">
                  <p className="px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Organizacion
                  </p>
                  {memberships.length > 1 ? (
                    <select
                      value={activeOrganization.id}
                      onChange={(event) => void switchOrganization(event.target.value)}
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-800 outline-none"
                      aria-label="Cambiar organizacion"
                    >
                      {memberships.map((membership) => (
                        <option key={membership.organizationId} value={membership.organizationId}>
                          {membership.organizationName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-800">
                      {activeOrganization.name}
                    </div>
                  )}
                  <p className="px-2 text-[11px] font-medium text-slate-400">
                    Plan {activePlanName || 'sin plan'} · {activeOrgRole}
                  </p>
                </div>
              )}

              {/* Menu Links */}
              <div className="space-y-0.5">
                <Link 
                  href="/perfil?tab=personal" 
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-bold text-slate-600 hover:bg-slate-50 hover:text-[#1e3a5f] transition-all"
                >
                  <User size={18} className="text-slate-400" />
                  Mi perfil
                </Link>

                <Link 
                  href="/perfil?tab=billing" 
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-bold text-slate-600 hover:bg-slate-50 hover:text-[#1e3a5f] transition-all"
                >
                  <Star size={18} className="text-slate-400" />
                  Planes y facturacion
                </Link>
              </div>

              {/* Logout Button */}
              <div className="mt-1 pt-1 border-t border-slate-50">
                <button 
                  onClick={() => {
                    logout();
                    setIsUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-bold text-red-500 hover:bg-red-50 transition-all"
                >
                  <LogOut size={18} />
                  Cerrar sesion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isMobileMenuOpen && (
        <div 
          className={cn(
            "fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden",
            isMobileMenuClosing ? "animate-out fade-out duration-700" : "animate-in fade-in duration-300"
          )}
          onClick={handleCloseMobileMenu}
        >
          <div 
            ref={mobileSidebarRef}
            className={cn(
              "absolute inset-y-0 left-0 w-[82%] bg-white shadow-2xl p-6 flex flex-col",
              isMobileMenuClosing ? "animate-slide-left-exit" : "animate-slide-right-enter"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between mb-10">
              <BrandMark href="/dashboard" compact />
              <button 
                onClick={handleCloseMobileMenu}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* User Section (Moved Up) */}
            <div className="bg-slate-50 rounded-[28px] p-5 mb-8">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-900/20">
                  {userInitials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[17px] font-bold text-gray-900 truncate">
                    {userDisplayName}
                  </span>
                  <span className="text-[13px] text-slate-500 font-medium">
                    {isSuperAdmin(user) ? 'Super Admin' : activeMembership ? activeOrgRole : isAdmin(user) ? 'Administrador' : 'Miembro'}
                  </span>
                </div>
              </div>
              {activeOrganization && (
                <div className="mb-5 rounded-2xl bg-white border border-slate-100 p-3 text-left">
                  {memberships.length > 1 ? (
                    <select
                      value={activeOrganization.id}
                      onChange={(event) => void switchOrganization(event.target.value)}
                      className="w-full bg-transparent text-[14px] font-bold text-slate-800 outline-none"
                      aria-label="Cambiar organizacion"
                    >
                      {memberships.map((membership) => (
                        <option key={membership.organizationId} value={membership.organizationId}>
                          {membership.organizationName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[14px] font-bold text-slate-800">{activeOrganization.name}</p>
                  )}
                  <p className="mt-1 text-[11px] font-medium text-slate-400">
                    Plan {activePlanName || 'sin plan'} · {activeOrgRole}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  logout();
                  handleCloseMobileMenu();
                }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white border border-red-100 px-5 py-3 text-[14px] font-bold text-red-500 shadow-sm active:bg-red-50 transition-all"
              >
                <LogOut size={18} />
                Cerrar sesion
              </button>
            </div>

            {/* Navigation Section */}
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-5 mb-1">NAVEGACION</p>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-4 rounded-2xl px-6 py-4 text-[16px] font-bold transition-all',
                      active
                        ? 'bg-[#1e3a5f] shadow-xl shadow-blue-900/20 scale-[1.02]'
                        : 'text-slate-600 hover:bg-slate-50'
                    )}
                    onClick={handleCloseMobileMenu}
                  >
                    <Icon size={22} className={active ? 'text-white' : 'text-slate-400'} />
                    <span className={active ? 'text-white' : 'text-slate-600'}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
              <Link
                href="/perfil?tab=personal"
                className={cn(
                  'flex items-center gap-4 rounded-2xl px-6 py-4 text-[16px] font-bold transition-all',
                  isActive('/perfil') 
                    ? 'bg-[#1e3a5f] shadow-xl shadow-blue-900/20 scale-[1.02]' 
                    : 'text-slate-600 hover:bg-slate-50'
                )}
                onClick={handleCloseMobileMenu}
              >
                <User size={22} className={isActive('/perfil') ? 'text-white' : 'text-slate-400'} />
                <span className={isActive('/perfil') ? 'text-white' : 'text-slate-600'}>
                  Perfil
                </span>
              </Link>
            </div>

            <div className="mt-auto text-center pt-8">
              <p className="text-[11px] text-slate-300 font-medium tracking-widest uppercase">Tino Tasks v1.0</p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
