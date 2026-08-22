import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 화면이 쓰는 글자 크기 중 index.css에 정의되지 않은 것이 하나라도 있으면,
// 그 크기만 Tailwind 기본값(고정 px)으로 남아 화면 폭에 반응하지 않는다.
// 눈으로는 잘 안 보이고 특정 폰에서만 어긋나므로 검사를 자동화한다.
//
// index.css를 import로 읽지 않는다. Vitest는 CSS import를 처리하지 않고
// 빈 문자열을 돌려주므로(?raw 를 붙여도 마찬가지다) 검사가 조용히 다 통과한다.
// 파일에서 직접 읽는다.

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = readFileSync(join(SRC, 'index.css'), 'utf8');

function collectTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectTsx(full);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [full] : [];
  });
}

function usedFontSizes(): string[] {
  const found = new Set<string>();
  for (const file of collectTsx(SRC)) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/g)) {
      found.add(match[1]);
    }
  }
  return [...found].sort();
}

describe('글자 크기 토큰', () => {
  const sizes = usedFontSizes();

  it('index.css를 실제로 읽어 왔다', () => {
    // 빈 문자열을 상대로 검사하면 아래가 전부 조용히 통과한다.
    expect(css).toContain('@theme');
  });

  it('화면에서 글자 크기를 실제로 쓰고 있다', () => {
    expect(sizes.length).toBeGreaterThan(0);
  });

  it.each(sizes)('text-%s 가 index.css에 정의되어 있다', (size) => {
    expect(css).toContain(`--text-${size}:`);
  });

  it.each(sizes)('text-%s 의 줄간격이 정해져 있다', (size) => {
    expect(css).toContain(`--text-${size}--line-height:`);
  });

  it.each(sizes)('text-%s 가 화면 폭에 반응한다', (size) => {
    const line = css.split('\n').find((row) => row.includes(`--text-${size}:`)) ?? '';
    // clamp(최소, 화면폭 기준값, 최대) 형태여야 화면 폭에 따라 움직인다.
    expect(line).toMatch(/clamp\(/);
    expect(line).toMatch(/vw/);
  });
});

describe('겹침을 막는 전역 규칙', () => {
  it('입력칸이 자기 고유 폭을 고집하지 못하게 막는다', () => {
    // 이것이 없으면 아이폰의 날짜 입력칸이 옆 칸 위로 올라타 테두리가 겹친다.
    expect(css).toMatch(/input,\s*select,\s*textarea\s*\{[^}]*min-width:\s*0/);
  });

  it('입력칸이 부모 상자를 넘지 못하게 막는다', () => {
    expect(css).toMatch(/input,\s*select,\s*textarea\s*\{[^}]*max-width:\s*100%/);
  });

  it('그 규칙이 @layer base 안에 있다', () => {
    // 레이어 밖에 두면 Tailwind 유틸리티(@layer utilities)보다 세져서, 화면에서
    // min-w-40 같은 예외를 주려 해도 먹지 않는다. 순서가 아니라 계단 문제다.
    const base = css.match(/@layer base\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(base).toMatch(/input,\s*select,\s*textarea/);
  });

  it('아이폰 홈 인디케이터를 피하는 여백이 있다', () => {
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});
