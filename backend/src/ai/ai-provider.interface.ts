export interface BrandKit {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontHeading?: string;
  fontBody?: string;
}

export interface LayoutGenContext {
  tenantId: string;
  propertyId: string;
  brandTokens?: BrandKit;
  engineType?: string;
}

export interface UIBlockDraft {
  id: string;
  type: string;
  props: Record<string, any>;
  position?: { x: number; y: number; z: number; width?: string; height?: string };
}

export interface AIProvider {
  generateLayoutDraft(prompt: string, context: LayoutGenContext): Promise<UIBlockDraft[]>;
  generateAltText(imageUrl: string): Promise<string>;
}
