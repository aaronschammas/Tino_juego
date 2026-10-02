"use client";
import { FormEvent, useState } from "react";

export default function TaskCommentForm({
  onSubmit,
}: {
  onSubmit: (content: string) => Promise<boolean | void>;
}) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const valid = content.trim().length > 0 && content.length <= 2000;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    try {
      if (await onSubmit(content)) setContent("");
    } finally {
      setSending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="task-comment" className="sr-only">
        Nuevo comentario
      </label>
      <textarea
        id="task-comment"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Escribí un comentario..."
        className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          {content.length} / 2000
        </span>
        <button
          disabled={!valid || sending}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {sending ? "Publicando..." : "Publicar"}
        </button>
      </div>
    </form>
  );
}
