/**
 * STUB: this package does not call a language model or any network API.
 * The interface is the seam for a future assistant. StubAiAssistant fails
 * closed so callers cannot mistake it for a live model.
 */

export const AI_IMPLEMENTATION = 'STUB' as const;

export type MenuLine = {
  productName: string;
  quantity: number;
};

export type MenuSuggestionRequest = {
  ticketLines: MenuLine[];
};

export type MenuSuggestion = {
  productName: string;
  reason: string;
};

export interface AiAssistant {
  readonly implementation: typeof AI_IMPLEMENTATION;
  suggestAdditions(input: MenuSuggestionRequest): Promise<MenuSuggestion[]>;
}

export class StubAiAssistant implements AiAssistant {
  readonly implementation = AI_IMPLEMENTATION;

  async suggestAdditions(_input: MenuSuggestionRequest): Promise<MenuSuggestion[]> {
    throw new Error('STUB: AiAssistant does not call a model');
  }
}
