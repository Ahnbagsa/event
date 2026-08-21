const PARSE_FAILURE = 'AI 응답을 이해할 수 없습니다. 다시 시도해 주세요.';

function stripFence(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return fenced === null ? text : fenced[1];
}

function sliceOutermost(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const candidates = [firstBrace, firstBracket].filter((index) => index !== -1);
  if (candidates.length === 0) return null;

  const start = Math.min(...candidates);
  const closing = text[start] === '{' ? '}' : ']';
  const end = text.lastIndexOf(closing);
  if (end <= start) return null;

  return text.slice(start, end + 1);
}

export function extractJson(text: string): unknown {
  const candidate = sliceOutermost(stripFence(text));
  if (candidate === null) throw new Error(PARSE_FAILURE);

  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error(PARSE_FAILURE);
  }
}
