/**
 * Convierte la respuesta del asistente en texto de WhatsApp.
 *
 * El asistente devuelve siempre la misma estructura (título, resumen, detalles y
 * una recomendación opcional). Acá se traduce a texto plano con el formato que
 * entiende WhatsApp: `*negrita*` para el título, `_cursiva_` para la
 * recomendación y viñetas para los detalles.
 *
 * Qué contiene:
 * - `formatAssistantAnswer()`: arma el mensaje completo de una consulta.
 * - `truncateForWhatsApp()`: recorta al límite de 4096 caracteres que Meta acepta
 *   en el cuerpo de un mensaje, cortando en el último espacio para no partir una
 *   palabra.
 * - `WHATSAPP_TEXT_LIMIT`: ese límite, también usado por el cliente.
 *
 * No agrega ningún dato que el asistente no haya devuelto: si no hay detalles, no
 * inventa líneas.
 */
import type { AssistantResponse } from '../assistant/assistant.service';

export const WHATSAPP_TEXT_LIMIT = 4096;
export const MENU_HINT = 'Escribí *menú* para ver otras consultas.';

export function truncateForWhatsApp(
  text: string,
  limit = WHATSAPP_TEXT_LIMIT,
): string {
  if (text.length <= limit) return text;

  const hardCut = text.slice(0, limit - 1);
  const lastSpace = hardCut.lastIndexOf(' ');
  const cut = lastSpace > limit * 0.5 ? hardCut.slice(0, lastSpace) : hardCut;
  return `${cut.trimEnd()}…`;
}

export function formatAssistantAnswer(answer: AssistantResponse): string {
  const blocks: string[] = [`*${answer.title}*\n${answer.summary}`];

  if (answer.details.length > 0) {
    blocks.push(answer.details.map((detail) => `• ${detail}`).join('\n'));
  }

  if (answer.recommendation) {
    blocks.push(`_Recomendación:_ ${answer.recommendation}`);
  }

  blocks.push(MENU_HINT);

  return truncateForWhatsApp(blocks.join('\n\n'));
}
