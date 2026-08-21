import type { DiscoveredModel } from '../types';

export type RawModel = {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
};

const EXCLUDED_NAME_PARTS = ['embedding', 'aqa', 'imagen', 'veo', 'tts'];

export function isUsableModel(model: RawModel): boolean {
  const lower = model.name.toLowerCase();
  if (EXCLUDED_NAME_PARTS.some((part) => lower.includes(part))) return false;
  return model.supportedGenerationMethods?.includes('generateContent') ?? false;
}

export function scoreModelName(name: string): number {
  const lower = name.toLowerCase();
  let score = 0;

  const version = /(\d+)\.(\d+)/.exec(lower);
  if (version !== null) {
    score += (Number(version[1]) + Number(version[2]) / 10) * 100;
  }

  if (lower.includes('flash')) score += 50;
  if (lower.includes('pro')) score += 10;
  if (lower.includes('lite')) score -= 15;
  if (lower.includes('thinking')) score -= 20;
  if (lower.includes('preview') || lower.includes('experimental') || /\bexp\b|-exp/.test(lower)) {
    score -= 80;
  }

  return score;
}

export function pickModels(models: RawModel[]): DiscoveredModel[] {
  return models
    .filter(isUsableModel)
    .map((model) => ({
      name: model.name,
      displayName: model.displayName ?? model.name,
      score: scoreModelName(model.name),
      inputTokenLimit: model.inputTokenLimit ?? 0,
      outputTokenLimit: model.outputTokenLimit ?? 0,
    }))
    .sort((a, b) => (b.score - a.score) || (b.outputTokenLimit - a.outputTokenLimit));
}
