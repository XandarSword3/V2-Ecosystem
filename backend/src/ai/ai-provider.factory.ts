import { AIProvider } from './ai-provider.interface';
import { DisabledAIProvider } from './providers/disabled-ai-provider';

export function getAIProvider(): AIProvider {
  const providerType = (process.env.AI_PROVIDER || 'disabled').toLowerCase();

  switch (providerType) {
    case 'openai':
    case 'anthropic':
    case 'gemini':
      // Provider seam: Return DisabledAIProvider until specific adapter API keys are configured
      return new DisabledAIProvider();
    case 'disabled':
    default:
      return new DisabledAIProvider();
  }
}
