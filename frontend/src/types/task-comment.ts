export interface TaskCommentAuthor {
  id: string;
  name: string;
  lastname: string;
  displayName: string;
}
export interface TaskComment {
  id: string;
  content: string | null;
  taskId: string;
  author: TaskCommentAuthor | null;
  externalAuthor?: { displayName: string; source: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isEdited: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
export interface TaskCommentsPage {
  items: TaskComment[];
  nextCursor: string | null;
}
