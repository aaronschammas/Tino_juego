'use client';

import { useCallback } from 'react';
import { apiGetCached, apiPost, apiPatch, apiPut, apiDelete, invalidateApiCache } from '@/lib/api';
import {
  Organization,
  OrganizationDetail,
  InviteMembersDto,
  CreateOrganizationDto,
  AcceptInviteDto,
  OrganizationMember,
  OrganizationInvite,
  InviteResponse,
  Plan,
} from '@/types/organization';

const ORG_STALE_TIME_MS = 45_000;

export function useOrganizations() {
  const createOrganization = useCallback(async (data: CreateOrganizationDto) => {
    const organization = await apiPost<Organization>('/orgs', data);
    invalidateApiCache('/orgs');
    return organization;
  }, []);

  const getMyOrganization = useCallback(async (options?: { force?: boolean }) => {
    return await apiGetCached<OrganizationDetail>('/orgs/me', {
      staleTime: ORG_STALE_TIME_MS,
      force: options?.force,
    });
  }, []);

  const getPlans = useCallback(async () => {
    return await apiGetCached<Plan[]>('/plans', {
      staleTime: 3600_000, // 1 hour for plans
    });
  }, []);

  const getMembers = useCallback(async (options?: { force?: boolean }) => {
    return await apiGetCached<OrganizationMember[]>('/orgs/members', {
      staleTime: ORG_STALE_TIME_MS,
      force: options?.force,
    });
  }, []);

  const getInvitations = useCallback(async (options?: { force?: boolean }) => {
    return await apiGetCached<OrganizationInvite[]>('/orgs/invites', {
      staleTime: ORG_STALE_TIME_MS,
      force: options?.force,
    });
  }, []);

  const inviteMember = useCallback(async (data: InviteMembersDto): Promise<InviteResponse> => {
    try {
      const response = await apiPost<InviteResponse>('/orgs/invites', data);
      invalidateApiCache(['/orgs/me', '/orgs/members', '/orgs/invites']);
      return response;
    } catch (error) {
      console.error('Error inviting member:', error);
      throw error;
    }
  }, []);

  const resendInvite = useCallback(async (inviteId: string) => {
    try {
      const response = await apiPost(`/orgs/invites/${inviteId}/resend`, {});
      invalidateApiCache(['/orgs/me', '/orgs/invites']);
      return response;
    } catch (error) {
      console.error('Error resending invite:', error);
      throw error;
    }
  }, []);

  const revokeInvite = useCallback(async (inviteId: string) => {
    try {
      const response = await apiDelete(`/orgs/invites/${inviteId}`);
      invalidateApiCache(['/orgs/me', '/orgs/invites']);
      return response;
    } catch (error) {
      console.error('Error revoking invite:', error);
      throw error;
    }
  }, []);

  const updateMemberRole = useCallback(async (userId: string, role: string) => {
    try {
      const response = await apiPatch(`/orgs/members/${userId}`, { role });
      invalidateApiCache(['/orgs/me', '/orgs/members']);
      return response;
    } catch (error) {
      console.error('Error updating member role:', error);
      throw error;
    }
  }, []);

  const removeMember = useCallback(async (userId: string) => {
    try {
      const response = await apiDelete(`/orgs/members/${userId}`);
      invalidateApiCache(['/orgs/me', '/orgs/members', '/users']);
      return response;
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  }, []);

  const acceptInvite = useCallback(async (token: string, data: AcceptInviteDto) => {
    try {
      const response = await apiPost(`/invites/${token}/accept`, data);
      invalidateApiCache(['/orgs/me', '/users']);
      return response;
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  }, []);

  const updateMemberProjects = useCallback(async (userId: string, projectIds: string[]) => {
    try {
      const response = await apiPut(`/orgs/members/${userId}/projects`, { projectIds });
      invalidateApiCache(['/orgs/me', '/projects']);
      return response;
    } catch (error) {
      console.error('Error updating member projects:', error);
      throw error;
    }
  }, []);

  const removeMemberFromProject = useCallback(async (userId: string, projectId: string) => {
    try {
      const response = await apiDelete(`/orgs/members/${userId}/projects/${projectId}`);
      invalidateApiCache(['/orgs/me', '/projects']);
      return response;
    } catch (error) {
      console.error('Error removing member from project:', error);
      throw error;
    }
  }, []);

  return {
    createOrganization,
    getMyOrganization,
    getPlans,
    getMembers,
    getInvitations,
    inviteMember,
    resendInvite,
    revokeInvite,
    updateMemberRole,
    removeMember,
    acceptInvite,
    updateMemberProjects,
    removeMemberFromProject,
  };
}
