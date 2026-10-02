export interface AssistantAnswer {
  intent: string;
  confidence: number;
  title: string;
  summary: string;
  details: string[];
  recommendation?: string;
  data?: unknown;
}

export type AssistantMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; answer: AssistantAnswer };
