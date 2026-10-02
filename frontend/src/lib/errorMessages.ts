
const ERROR_MESSAGE_TRANSLATIONS: Record<string, string> = {
  // Tasks (backend/src/modules/tasks/tasks.service.ts)
  'Cannot complete parent task while a subtask has an active timer':
    'No se puede completar la tarea padre mientras una subtarea tiene un cronómetro activo.',
  'User must belong to an organization': 'El usuario debe pertenecer a una organización.',
  'Project not found': 'Proyecto no encontrado.',
  'You are not a member of this project': 'No sos miembro de este proyecto.',
  'Parent task not found in this project': 'Tarea padre no encontrada en este proyecto.',
  'Subtasks cannot have subtasks': 'Las subtareas no pueden tener subtareas.',
  'You cannot assign tasks in this project': 'No podés asignar tareas en este proyecto.',
  'Assigned user not found or inactive': 'El usuario asignado no existe o está inactivo.',
  'Assigned user is not a member of this project':
    'El usuario asignado no es miembro de este proyecto.',
  'Task not found': 'Tarea no encontrada.',
  'Members can only change task status or take unassigned tasks':
    'Los miembros solo pueden cambiar el estado o tomar tareas no asignadas.',
  'Parent task estimated hours are calculated from subtasks':
    'Las horas estimadas de la tarea padre se calculan a partir de las subtareas.',
  'Only project owners can delete tasks': 'Solo los propietarios del proyecto pueden eliminar tareas.',

  // Projects (backend/src/modules/projects/projects.service.ts)
  'Only organization owners can create projects':
    'Solo los propietarios de la organización pueden crear proyectos.',
  'Only project owner can update the project': 'Solo el propietario del proyecto puede editarlo.',
  'Only project owner can delete the project': 'Solo el propietario del proyecto puede eliminarlo.',

  // Organizations / member projects (backend/src/modules/organizations/organizations.service.ts)
  'Only organization owners can update organization plan':
    'Solo los propietarios pueden actualizar el plan de la organización.',
  'Only organization owners can invite members': 'Solo los propietarios pueden invitar miembros.',
  'Only organization owners can remove members': 'Solo los propietarios pueden eliminar miembros.',
  'Only organization owners can view invitations': 'Solo los propietarios pueden ver las invitaciones.',
  'Only organization owners can resend invitations':
    'Solo los propietarios pueden reenviar invitaciones.',
  'Only organization owners can revoke invitations':
    'Solo los propietarios pueden revocar invitaciones.',
  'Only organization owners can update member roles':
    'Solo los propietarios pueden actualizar los roles de los miembros.',
  'Only organization owners can update member projects':
    'Solo los propietarios pueden actualizar proyectos de miembros.',
  'Only organization owners can remove members from projects':
    'Solo los propietarios pueden quitar miembros de los proyectos.',
  'Only organization owners can sync memberships':
    'Solo los propietarios pueden sincronizar membresías.',
  'Organization membership mismatch': 'La membresía de la organización no coincide.',
  'You do not belong to this organization': 'No pertenecés a esta organización.',

  // Generic (backend/src/common/dto/error-codes.ts)
  'Unauthorized access': 'Acceso no autorizado.',
  'Invalid authentication token': 'Token de autenticación inválido.',
  'Authentication token has expired': 'El token de autenticación expiró.',
  'Access forbidden': 'Acceso denegado.',
  'Insufficient permissions for this action': 'No tenés permisos suficientes para esta acción.',
  'Only organization owners can perform this action':
    'Solo los propietarios de la organización pueden realizar esta acción.',
  'Resource not found': 'Recurso no encontrado.',
  'User not found': 'Usuario no encontrado.',
  'Organization not found': 'Organización no encontrada.',
  'Bad request': 'Solicitud inválida.',
  'Invalid input provided': 'Los datos ingresados no son válidos.',
  'Validation failed': 'La validación falló.',
};


export function translateErrorMessage(message: string | undefined | null, fallback: string): string {
  if (!message) return fallback;
  return ERROR_MESSAGE_TRANSLATIONS[message.trim()] ?? message;
}
