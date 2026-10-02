'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isSuperAdmin } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { ShieldCheck, Users, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { apiGet, apiDelete } from '@/lib/api';
import OrgModal from '@/components/admin/OrgModal';
import MemberModal from '@/components/admin/MemberModal';
import UserEditModal from '@/components/admin/UserEditModal';

interface User {
  id: string;
  name: string;
  lastname: string;
  email: string;
}

interface Organization {
  id: string;
  name: string;
  isActive: boolean;
  planId?: string | null;
  plan?: { name: string; title: string } | null;
  memberships?: { user: User; role: string }[];
}

export default function UsersOrgsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  // Modal states
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeOrgId, setActiveOrgId] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !isSuperAdmin(user)) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isSuperAdmin(user)) {
      fetchOrganizations();
    }
  }, [user]);

  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const data = await apiGet<Organization[]>('/admin/orgs');
      setOrganizations(data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleDeleteOrg = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta organización? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await apiDelete(`/admin/orgs/${id}`);
      fetchOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
      alert('Error al eliminar la organización');
    }
  };

  const handleDeleteMember = async (orgId: string, userId: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este miembro de la organización?')) {
      return;
    }

    try {
      await apiDelete(`/admin/orgs/${orgId}/members/${userId}`);
      fetchOrganizations();
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Error al eliminar el miembro');
    }
  };

  if (isLoading || !isSuperAdmin(user)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-[1600px] px-4 pt-28 pb-8 md:px-8">
        <div className="flex flex-col gap-8 animate-page-enter">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-[#1e3a5f]">
              <ShieldCheck size={32} />
              <h1 className="text-3xl font-extrabold tracking-tight">Gestión de Organizaciones y Usuarios</h1>
            </div>
            <p className="text-slate-500 font-medium ml-11">
              Administración global de organizaciones, miembros y planes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900">Organizaciones</h2>
            <button 
              onClick={() => {
                setSelectedOrg(null);
                setIsOrgModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg hover:bg-[#152a46] transition-colors w-full sm:w-auto justify-center"
            >
              <Plus size={16} />
              Nueva Organización
            </button>
          </div>

          {loadingOrgs ? (
            <div className="text-center text-slate-500 py-8">Cargando organizaciones...</div>
          ) : (
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Miembros</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {organizations.map((org) => (
                      <React.Fragment key={org.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                {expandedOrg === org.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <span className="font-medium text-slate-900">{org.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-slate-600">{org.plan?.title || 'Sin Plan'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${org.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {org.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                            {org.memberships?.length || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setIsOrgModalOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 p-1"
                              >
                                <Pencil size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteOrg(org.id)}
                                className="text-red-600 hover:text-red-900 p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedOrg === org.id && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={5} className="px-4 sm:px-12 py-4">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                <h3 className="text-sm font-semibold text-slate-700">Miembros de {org.name}</h3>
                                <button 
                                  onClick={() => {
                                    setActiveOrgId(org.id);
                                    setIsMemberModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300 transition-colors w-full sm:w-auto justify-center"
                                >
                                  <Plus size={12} />
                                  Agregar Miembro
                                </button>
                              </div>
                              {org.memberships && org.memberships.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-slate-500 border-b border-slate-200">
                                        <th className="text-left py-2">Nombre</th>
                                        <th className="text-left py-2">Email</th>
                                        <th className="text-left py-2">Rol</th>
                                        <th className="text-right py-2">Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {org.memberships.map((membership) => (
                                        <tr key={membership.user.id} className="border-b border-slate-100 last:border-0">
                                          <td className="py-2 text-slate-900">{membership.user.name} {membership.user.lastname}</td>
                                          <td className="py-2 text-slate-600">{membership.user.email}</td>
                                          <td className="py-2">
                                            <span className={`text-xs ${membership.role === 'ORG_OWNER' ? 'text-indigo-600 font-semibold' : 'text-slate-600'}`}>
                                              {membership.role === 'ORG_OWNER' ? 'Propietario' : 'Miembro'}
                                            </span>
                                          </td>
                                          <td className="py-2 text-right">
                                            <div className="flex justify-end gap-2">
                                              <button 
                                                onClick={() => {
                                                  setSelectedUser(membership.user);
                                                  setIsUserEditModalOpen(true);
                                                }}
                                                className="text-blue-600 hover:text-blue-900 p-1"
                                              >
                                                <Pencil size={14} />
                                              </button>
                                              <button 
                                                onClick={() => handleDeleteMember(org.id, membership.user.id)}
                                                className="text-red-600 hover:text-red-900 p-1"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500">No hay miembros en esta organización.</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <OrgModal 
        isOpen={isOrgModalOpen} 
        onClose={() => setIsOrgModalOpen(false)} 
        onSuccess={fetchOrganizations} 
        organization={selectedOrg}
      />
      
      <MemberModal 
        isOpen={isMemberModalOpen} 
        onClose={() => setIsMemberModalOpen(false)} 
        onSuccess={fetchOrganizations} 
        orgId={activeOrgId}
      />

      <UserEditModal
        isOpen={isUserEditModalOpen}
        onClose={() => setIsUserEditModalOpen(false)}
        onSuccess={fetchOrganizations}
        user={selectedUser}
      />
    </div>
  );
}
