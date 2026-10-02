'use client';

import { FormEvent, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useTinoAssistant } from '@/hooks/useTinoAssistant';

export default function TinoAssistantScreen() {
  const assistant = useTinoAssistant();
  const [query, setQuery] = useState('');
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const sent = await assistant.send(query);
    if (sent) setQuery('');
  };
  const suggest = async (value: string) => {
    setQuery('');
    await assistant.send(value);
  };

  return (
    <section className="mobile-assistant" aria-labelledby="tino-assistant-title">
      <header className="mobile-dashboard-intro">
        <p className="mobile-eyebrow">Consultas de Tino</p>
        <h1 id="tino-assistant-title">Preguntale a Tino</h1>
        <p>Respuestas rápidas sobre tareas, horas, proyectos y equipo.</p>
      </header>

      {assistant.messages.length === 0 && <div className="mobile-assistant-welcome">
        <Sparkles aria-hidden="true" />
        <h2>Podés preguntarme cosas como:</h2>
        <div className="mobile-assistant-chips">{assistant.suggestions.map((suggestion) => <button key={suggestion} disabled={assistant.loading} onClick={() => void suggest(suggestion)}>{suggestion}</button>)}</div>
      </div>}

      <div className="mobile-assistant-thread" aria-live="polite">
        {assistant.messages.map((message) => message.role === 'user'
          ? <article key={message.id} className="mobile-chat-message is-user"><p>{message.text}</p></article>
          : <article key={message.id} className="mobile-chat-message is-assistant"><h2>{message.answer.title}</h2><p>{message.answer.summary}</p>{message.answer.details.length > 0 && <ul>{message.answer.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}{message.answer.recommendation && <p className="mobile-chat-recommendation"><strong>Recomendación:</strong> {message.answer.recommendation}</p>}</article>)}
        {assistant.loading && <div className="mobile-chat-loading" role="status">Tino está consultando datos reales…</div>}
        {assistant.error && <div className="mobile-block-error" role="alert"><p>{assistant.error}</p><button onClick={() => void assistant.send(query || assistant.messages.findLast((message) => message.role === 'user')?.text || '')}>Reintentar</button></div>}
      </div>

      <form className="mobile-assistant-composer" onSubmit={(event) => void submit(event)}>
        <label><span className="sr-only">Preguntá sobre tu equipo</span><input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={300} placeholder="Preguntá sobre tu equipo" disabled={assistant.loading} /></label>
        <button type="submit" disabled={assistant.loading || query.trim().length < 2} aria-label="Enviar consulta"><Send aria-hidden="true" /></button>
      </form>
    </section>
  );
}
