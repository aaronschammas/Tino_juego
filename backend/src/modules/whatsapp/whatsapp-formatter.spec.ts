import {
  formatAssistantAnswer,
  MENU_HINT,
  truncateForWhatsApp,
  WHATSAPP_TEXT_LIMIT,
} from './whatsapp-formatter';
import type { AssistantResponse } from '../assistant/assistant.service';

const answer = (
  overrides: Partial<AssistantResponse> = {},
): AssistantResponse => ({
  intent: 'overdue_tasks',
  confidence: 0.95,
  title: 'Tareas atrasadas',
  summary: 'Encontré 2 tareas vencidas sin completar.',
  details: ['Corregir login · Portal', 'Migrar facturación · ERP'],
  ...overrides,
});

describe('formatAssistantAnswer', () => {
  it('formats title, summary, details and recommendation', () => {
    const text = formatAssistantAnswer(
      answer({ recommendation: 'Revisá primero las más viejas.' }),
    );

    expect(text).toContain('*Tareas atrasadas*');
    expect(text).toContain('Encontré 2 tareas vencidas sin completar.');
    expect(text).toContain('• Corregir login · Portal');
    expect(text).toContain('_Recomendación:_ Revisá primero las más viejas.');
    expect(text).toContain(MENU_HINT);
  });

  it('omits the details block and the recommendation when there are none', () => {
    const text = formatAssistantAnswer(
      answer({ details: [], summary: 'No encontré tareas atrasadas.' }),
    );

    expect(text).not.toContain('•');
    expect(text).not.toContain('Recomendación');
    expect(text).toBe(
      `*Tareas atrasadas*\nNo encontré tareas atrasadas.\n\n${MENU_HINT}`,
    );
  });

  it('never exceeds the WhatsApp text limit', () => {
    const text = formatAssistantAnswer(
      answer({ details: Array.from({ length: 400 }, () => 'a'.repeat(40)) }),
    );

    expect(text.length).toBeLessThanOrEqual(WHATSAPP_TEXT_LIMIT);
  });
});

describe('truncateForWhatsApp', () => {
  it('leaves short text untouched', () => {
    expect(truncateForWhatsApp('hola')).toBe('hola');
  });

  it('cuts on a word boundary and marks the cut', () => {
    const text = truncateForWhatsApp('uno dos tres cuatro', 12);

    expect(text).toBe('uno dos…');
    expect(text.length).toBeLessThanOrEqual(12);
  });

  it('cuts mid-word when there is no usable space', () => {
    expect(truncateForWhatsApp('abcdefghij', 5)).toBe('abcd…');
  });
});
