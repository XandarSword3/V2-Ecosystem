import { AIProvider, LayoutGenContext, UIBlockDraft } from '../ai-provider.interface';

export class AIFeatureNotConfiguredError extends Error {
  constructor(message = 'AI features are currently disabled. Set AI_PROVIDER in environment variables to enable.') {
    super(message);
    this.name = 'AIFeatureNotConfiguredError';
  }
}

export class DisabledAIProvider implements AIProvider {
  async generateLayoutDraft(_prompt: string, _context: LayoutGenContext): Promise<UIBlockDraft[]> {
    throw new AIFeatureNotConfiguredError();
  }

  async generateAltText(_imageUrl: string): Promise<string> {
    throw new AIFeatureNotConfiguredError();
  }
}
