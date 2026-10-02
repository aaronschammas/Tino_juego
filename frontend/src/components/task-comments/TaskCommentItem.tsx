"use client";
import { useState } from "react";
import { TaskComment } from "@/types/task-comment";

export default function TaskCommentItem({
  comment,
  onEdit,
  onDelete,
}: {
  comment: TaskComment;
  onEdit: (id: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment.content ?? "");
  const [busy, setBusy] = useState(false);
  if (comment.deletedAt)
    return (
      <div className="rounded-xl bg-slate-50 p-3 text-sm italic text-slate-400">
        Comentario eliminado
      </div>
    );
  const author =
    comment.author?.displayName ||
    comment.externalAuthor?.displayName ||
    "Usuario eliminado";
  return (
    <article className="rounded-xl border border-slate-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-slate-700">{author}</span>
          {comment.externalAuthor && (
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              Trello
            </span>
          )}
          <span className="ml-2 text-[10px] text-slate-400">
            {new Date(comment.createdAt).toLocaleString("es-AR")}
            {comment.isEdited ? " · Editado" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          {comment.canEdit && (
            <button
              onClick={() => setEditing(!editing)}
              className="text-[10px] font-semibold text-blue-600"
            >
              Editar
            </button>
          )}
          {comment.canDelete && (
            <button
              onClick={async () => {
                if (window.confirm("¿Eliminar este comentario?")) {
                  setBusy(true);
                  try {
                    await onDelete(comment.id);
                  } finally {
                    setBusy(false);
                  }
                }
              }}
              disabled={busy}
              className="text-[10px] font-semibold text-red-600"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!value.trim() || value.length > 2000) return;
            setBusy(true);
            try {
              await onEdit(comment.id, value);
              setEditing(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <textarea
            aria-label="Editar comentario"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={2000}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
          />
          <button
            disabled={busy || !value.trim()}
            className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
          >
            Guardar
          </button>
        </form>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
          {comment.content}
        </p>
      )}
    </article>
  );
}
