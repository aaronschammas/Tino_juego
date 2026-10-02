"use client";
import { useTaskComments } from "@/hooks/useTaskComments";
import TaskCommentForm from "./TaskCommentForm";
import TaskCommentItem from "./TaskCommentItem";

export default function TaskCommentsSection({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const state = useTaskComments(projectId, taskId);
  return (
    <section
      className="border-t border-slate-100 px-4 py-5 sm:px-6"
      aria-label="Comentarios"
    >
      <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Comentarios
      </h3>
      {state.loading ? (
        <p className="text-sm text-slate-400">Cargando comentarios...</p>
      ) : state.error ? (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}{" "}
          <button
            onClick={() => void state.retry()}
            className="ml-2 font-bold underline"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {state.nextCursor && (
            <button
              onClick={() => void state.loadOlder()}
              disabled={state.loadingMore}
              className="mb-3 w-full text-xs font-semibold text-blue-600"
            >
              {state.loadingMore
                ? "Cargando..."
                : "Cargar comentarios anteriores"}
            </button>
          )}
          <div className="mb-4 space-y-3">
            {state.comments.length ? (
              state.comments.map((c) => (
                <TaskCommentItem
                  key={c.id}
                  comment={c}
                  onEdit={state.update}
                  onDelete={state.remove}
                />
              ))
            ) : (
              <p className="py-3 text-center text-sm text-slate-400">
                Todavía no hay comentarios.
              </p>
            )}
          </div>
          <TaskCommentForm onSubmit={state.create} />
        </>
      )}
    </section>
  );
}
