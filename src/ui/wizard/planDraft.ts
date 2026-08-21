import type { OutlineResult } from '../../gemini/extractOutline';

const KEY = 'haengsa-baksa:plan-draft';

export function savePlanDraft(draft: OutlineResult): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadPlanDraft(): OutlineResult | null {
  const raw = sessionStorage.getItem(KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as OutlineResult;
  } catch {
    return null;
  }
}

export function clearPlanDraft(): void {
  sessionStorage.removeItem(KEY);
}
