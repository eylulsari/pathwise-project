import { ConfigService } from '@nestjs/config';
import { PlacesService } from '../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../places/infrastructure/persistence/in-memory-place.repository';
import { GeminiClient } from '../infrastructure/gemini/gemini.client';
import { GroqClient } from '../infrastructure/groq/groq.client';
import { AssistantService } from './assistant.service';

/**
 * The dietary answer reaches the model, and reaches it with the caveat.
 *
 * The dataset records nothing about vegetarian or vegan options, so the risk
 * this guards is not the model forgetting the restriction — it is the model
 * confidently inventing a menu for a real café. Both halves are asserted: that
 * the restriction is stated, and that the prompt forbids claiming a specific
 * place caters to it.
 */
describe('dietary context reaches the assistant prompt', () => {
  const captured: string[] = [];

  const service = new AssistantService(
    { get: (k: string) => (k === 'GROQ_API_KEY' ? 'test-key' : undefined) } as unknown as ConfigService,
    new PlacesService(new InMemoryPlaceRepository()),
    {} as GeminiClient,
    {
      generate: (args: { systemInstruction: string }) => {
        captured.push(args.systemInstruction);
        return Promise.resolve({ text: 'ok', functionCall: undefined });
      },
    } as unknown as GroqClient,
  );

  const ask = async (dietary?: 'vegetarian' | 'vegan' | 'no-seafood') => {
    captured.length = 0;
    await service.chat({
      message: 'where should I eat in Kadıköy?',
      conversationHistory: [],
      activePlan: [],
      dietary,
    });
    return captured[0];
  };

  it('states the restriction when there is one', async () => {
    expect(await ask('vegetarian')).toContain('VEGETARIAN');
    expect(await ask('vegan')).toContain('VEGAN');
    expect(await ask('no-seafood')).toContain('SEAFOOD ALLERGY');
  });

  it('forbids claiming a specific place caters to it', async () => {
    const prompt = await ask('vegan');
    expect(prompt).toContain('does NOT record dietary options');
    expect(prompt).toMatch(/NEVER state that a specific place has/i);
  });

  it('says nothing at all when the traveller has no restriction', async () => {
    const prompt = await ask(undefined);
    expect(prompt).not.toContain('DIETARY:');
    // Not merely absent — it must not have been turned into a claim that the
    // user eats anything, which the model would otherwise act on.
    expect(prompt).not.toMatch(/no dietary|eats everything|no restriction/i);
  });
});
