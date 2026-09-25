import { describe, expect, it } from 'vitest';
import { AI_IMPLEMENTATION, StubAiAssistant } from './index.ts';

describe('STUB ai assistant', () => {
  it('is labeled STUB and does not invent suggestions', async () => {
    const assistant = new StubAiAssistant();
    expect(assistant.implementation).toBe('STUB');
    expect(AI_IMPLEMENTATION).toBe('STUB');
    await expect(assistant.suggestAdditions({ ticketLines: [] })).rejects.toThrow(/STUB/);
  });
});
