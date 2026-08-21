# 행사박사 다듬기 구현 계획 (계획서 4/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면 전체에 공통 디자인 규칙을 들여 투박함을 걷어내고, 안박사를 앱 얼굴로 세우며, 휴대폰 음원 선택과 긴 공유 링크라는 두 결함을 고친다.

**Architecture:** Tailwind v4의 `@theme`로 색 토큰을 한곳에 정의하고, `src/ui/kit/`의 다섯 부품(Button·Card·Notice·PageHeader·AnbaksaMark)을 통해서만 쓴다. 화면은 부품을 조립하기만 한다. 음원 문제는 확장자로 종류를 추측하는 순수 함수로, 링크 문제는 자리로 뜻을 정하는 v2 배열 형식과 QR로 푼다.

**Tech Stack:** Tailwind CSS v4 (`@theme`) · React 19 · qrcode-generator 2.0.4 (의존성 없음)

**Spec:** `docs/superpowers/specs/2026-08-21-haengsa-baksa-polish-design.md`

**전제:** 계획서 1·2·3이 모두 끝나 `main`에 병합되어 있어야 한다. 시작 시점 기준 테스트 299개가 통과한다.

## Global Constraints

- 계획서 1의 Global Constraints를 그대로 승계한다.
- **도메인 로직·IndexedDB 스키마·화면 이동 경로를 바꾸지 않는다.** 이 계획서는 겉모습과 두 개의 결함에 한정한다.
- **색을 화면에서 직접 쓰지 않는다.** `bg-blue-600` 같은 Tailwind 기본 색상 대신 `src/index.css`에 정의한 이름(`bg-accent`, `text-ink` 등)만 쓴다.
- 사용자에게 보이는 글은 **항상 한국어**다.
- **기존 테스트 299개가 계속 통과해야 한다.** 클래스만 바꾸는 작업이므로 원칙적으로 깨지지 않는다. 깨진다면 그 테스트가 겉모습에 기대고 있었다는 뜻이므로 함께 고치고, 무엇을 왜 고쳤는지 커밋 메시지에 남긴다.
- 버튼·제목의 **글자를 바꾸지 않는다.** 테스트가 글자로 요소를 찾는다. 꼭 바꿔야 하면 테스트도 같은 커밋에서 고친다.
- 색 값은 설계서 2절 표를 그대로 쓴다. 임의로 바꾸지 않는다.

## File Structure

| 경로 | 책임 |
|---|---|
| `src/index.css` | 색·모양 토큰 정의, body 기본 색 |
| `src/ui/kit/Button.tsx` | 버튼 한 종류. variant·size로 갈래를 낸다 |
| `src/ui/kit/Card.tsx` | 흰 바탕 둥근 상자 |
| `src/ui/kit/Notice.tsx` | 안내 상자 (info·warn·danger) |
| `src/ui/kit/PageHeader.tsx` | 뒤로가기 + 제목 + 오른쪽 슬롯 |
| `src/ui/kit/AnbaksaMark.tsx` | 안박사 캐릭터 SVG (mark·full) |
| `src/audio/mimeFromName.ts` | 파일 이름으로 음원 종류 추측 |
| `src/share/scenarioLink.ts` | v2 배열 형식 인코딩, v1 하위호환 해석 |
| `src/ui/share/QrCode.tsx` | 문자열을 QR SVG로 그린다 |

---

## Task 1: 디자인 토큰과 공통 부품

**Files:**
- Modify: `src/index.css`
- Create: `src/ui/kit/Button.tsx`, `src/ui/kit/Card.tsx`, `src/ui/kit/Notice.tsx`, `src/ui/kit/PageHeader.tsx`
- Test: `src/ui/kit/kit.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `<Button variant?: 'primary'|'secondary'|'ghost'|'danger' size?: 'md'|'lg' ...버튼속성 />` — `data-variant` 속성을 함께 내보낸다
  - `<Card as?: 'div'|'li' className?: string>{children}</Card>`
  - `<Notice tone?: 'info'|'warn'|'danger' ...>{children}</Notice>` — `data-tone` 속성을 함께 내보낸다
  - `<PageHeader title backTo? backLabel? right? />`

- [ ] **Step 1: 색 토큰 정의**

`src/index.css`를 아래 내용으로 바꾼다.

```css
@import "tailwindcss";

/* Tailwind v4는 @theme의 --color-* 를 bg-*, text-*, border-* 유틸리티로 만들어 준다.
   화면에서는 여기 정의한 이름만 쓴다. 색을 바꿀 일이 생기면 이 파일만 고친다. */
@theme {
  --color-paper: #FDFBF6;
  --color-paper-raised: #FFFFFF;
  --color-ink: #1B1917;
  --color-ink-soft: #6B635C;
  --color-line: #E7E0D5;
  --color-accent: #C75B2A;
  --color-accent-strong: #A8471E;
  --color-accent-soft: #FCEDE4;
  --color-ok: #2F6B4F;
  --color-warn: #B45309;
  --color-warn-soft: #FDF3E3;
  --color-danger: #B02A24;
  --color-danger-soft: #FBEAE8;
  --color-stage: #14110F;
}

html, body, #root { height: 100%; }
body {
  margin: 0;
  font-family: system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  word-break: keep-all;
  background-color: var(--color-paper);
  color: var(--color-ink);
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/ui/kit/kit.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Button from './Button';
import Card from './Card';
import Notice from './Notice';
import PageHeader from './PageHeader';

describe('Button', () => {
  it('글자를 그대로 보여준다', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
  });

  it('기본 갈래는 secondary다', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'secondary');
  });

  it('갈래를 지정하면 그대로 표시한다', () => {
    render(<Button variant="primary">저장</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'primary');
  });

  it('누르면 처리기를 부른다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled면 눌러도 처리기를 부르지 않는다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>저장</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('type을 주지 않으면 button이다 (폼 안에서 제출되지 않도록)', () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Card', () => {
  it('내용을 감싼다', () => {
    render(<Card>안쪽</Card>);
    expect(screen.getByText('안쪽')).toBeInTheDocument();
  });

  it('목록 항목으로도 쓸 수 있다', () => {
    render(<ul><Card as="li">항목</Card></ul>);
    expect(screen.getByRole('listitem')).toHaveTextContent('항목');
  });
});

describe('Notice', () => {
  it('기본 결은 info다', () => {
    render(<Notice>알림</Notice>);
    expect(screen.getByText('알림')).toHaveAttribute('data-tone', 'info');
  });

  it('결을 지정하면 그대로 표시한다', () => {
    render(<Notice tone="danger">위험</Notice>);
    expect(screen.getByText('위험')).toHaveAttribute('data-tone', 'danger');
  });
});

describe('PageHeader', () => {
  it('제목을 보여준다', () => {
    render(<MemoryRouter><PageHeader title="설정" /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument();
  });

  it('뒤로가기 주소를 주면 링크를 단다', () => {
    render(<MemoryRouter><PageHeader title="설정" backTo="/" backLabel="← 홈" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '← 홈' })).toHaveAttribute('href', '/');
  });

  it('뒤로가기 주소가 없으면 링크가 없다', () => {
    render(<MemoryRouter><PageHeader title="행사박사" /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('오른쪽 슬롯을 붙인다', () => {
    render(
      <MemoryRouter>
        <PageHeader title="설정" right={<span>오른쪽</span>} />
      </MemoryRouter>,
    );
    expect(screen.getByText('오른쪽')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- kit`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 4: Button 구현**

`src/ui/kit/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong disabled:bg-line disabled:text-ink-soft',
  secondary:
    'border border-ink bg-paper-raised text-ink hover:bg-accent-soft disabled:border-line disabled:text-ink-soft',
  ghost: 'text-accent hover:bg-accent-soft disabled:text-ink-soft',
  danger: 'text-danger hover:bg-danger-soft disabled:text-ink-soft',
};

const SIZES: Record<Size, string> = {
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-5 text-lg',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
```

- [ ] **Step 5: Card 구현**

`src/ui/kit/Card.tsx`:

```tsx
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  as?: 'div' | 'li';
  className?: string;
};

export default function Card({ children, as: Tag = 'div', className = '' }: Props) {
  return (
    <Tag className={`rounded-2xl border border-line bg-paper-raised p-4 ${className}`}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 6: Notice 구현**

`src/ui/kit/Notice.tsx`:

```tsx
import type { ReactNode } from 'react';

type Tone = 'info' | 'warn' | 'danger';

const TONES: Record<Tone, string> = {
  info: 'bg-accent-soft text-ink',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

type Props = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  'data-testid'?: string;
};

export default function Notice({
  children,
  tone = 'info',
  className = '',
  'data-testid': testId,
}: Props) {
  return (
    <div
      data-tone={tone}
      data-testid={testId}
      className={`rounded-2xl px-4 py-3 text-sm ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 7: PageHeader 구현**

`src/ui/kit/PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  backTo?: string;
  backLabel?: string;
  right?: ReactNode;
};

export default function PageHeader({ title, backTo, backLabel = '← 뒤로', right }: Props) {
  return (
    <header className="flex items-center gap-3 border-b border-line px-4 py-3">
      {backTo !== undefined && (
        <Link to={backTo} className="shrink-0 text-accent">{backLabel}</Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
      {right}
    </header>
  );
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test -- kit`
Expected: PASS (14 tests)

- [ ] **Step 9: 전체 테스트와 빌드 확인**

Run: `npm test`
Expected: PASS (313 tests — 기존 299 + 새 14)

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 10: 커밋**

```bash
git add src/index.css src/ui/kit
git commit -m "feat: 디자인 토큰과 공통 부품(Button·Card·Notice·PageHeader)"
```

---

## Task 2: 안박사 마크

**Files:**
- Create: `src/ui/kit/AnbaksaMark.tsx`
- Test: `src/ui/kit/AnbaksaMark.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `<AnbaksaMark variant?: 'mark'|'full' size?: number className?: string title?: string />`

원본 `ahnbagsa.svg`는 캐릭터(y 40~400)와 "안박사" 글자(y 420~525)가 한 파일에 있다.
`variant="mark"`는 얼굴만, `variant="full"`은 글자까지 보여준다.
색은 `currentColor`로 바꿔 어두운 배경에서도 쓸 수 있게 한다. 저장소 뿌리의 원본 파일은 그대로 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/kit/AnbaksaMark.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnbaksaMark from './AnbaksaMark';

describe('AnbaksaMark', () => {
  it('기본은 얼굴만 보여준다', () => {
    const { container } = render(<AnbaksaMark />);
    expect(container.querySelector('[data-part="wordmark"]')).toBeNull();
  });

  it('full이면 안박사 글자까지 보여준다', () => {
    const { container } = render(<AnbaksaMark variant="full" />);
    expect(container.querySelector('[data-part="wordmark"]')).not.toBeNull();
  });

  it('갈래에 따라 viewBox가 다르다', () => {
    const { container: mark } = render(<AnbaksaMark variant="mark" />);
    const { container: full } = render(<AnbaksaMark variant="full" />);
    expect(mark.querySelector('svg')).toHaveAttribute('viewBox', '40 20 330 400');
    expect(full.querySelector('svg')).toHaveAttribute('viewBox', '0 0 400 550');
  });

  it('크기를 지정할 수 있다', () => {
    const { container } = render(<AnbaksaMark size={64} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('height', '64');
  });

  it('선 색을 글자색에 맞춰 currentColor로 그린다', () => {
    const { container } = render(<AnbaksaMark />);
    expect(container.querySelector('g')).toHaveAttribute('stroke', 'currentColor');
  });

  it('설명을 주면 그림 이름으로 읽힌다', () => {
    render(<AnbaksaMark title="안박사" />);
    expect(screen.getByRole('img', { name: '안박사' })).toBeInTheDocument();
  });

  it('설명이 없으면 보조 기기에서 숨긴다', () => {
    const { container } = render(<AnbaksaMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- AnbaksaMark`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/ui/kit/AnbaksaMark.tsx`:

```tsx
type Props = {
  variant?: 'mark' | 'full';
  size?: number;
  className?: string;
  title?: string;
};

// 원본은 저장소 뿌리의 ahnbagsa.svg다. 색만 currentColor로 바꿔 옮겼다.
// <img>로 불러오면 색을 바꿀 수 없고 요청이 한 번 더 나가므로 그려 넣는다.
export default function AnbaksaMark({
  variant = 'mark',
  size = 40,
  className = '',
  title,
}: Props) {
  const viewBox = variant === 'full' ? '0 0 400 550' : '40 20 330 400';

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      className={className}
      role={title === undefined ? undefined : 'img'}
      aria-hidden={title === undefined ? true : undefined}
      aria-label={title}
    >
      {title !== undefined && <title>{title}</title>}
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 120 100 C 120 140, 280 140, 280 100 Z" fill="currentColor" />
        <polygon points="200,40 320,75 200,110 80,75" fill="currentColor" strokeWidth="10" />

        <path d="M 285 85 L 285 120" fill="none" strokeWidth="5" />
        <polygon points="280,120 290,120 295,145 275,145" fill="currentColor" strokeWidth="2" />

        <circle cx="200" cy="220" r="105" fill="var(--color-paper-raised)" strokeWidth="12" />

        <path d="M 100 215 C 80 210, 70 215, 75 225" fill="none" strokeWidth="10" />
        <path d="M 300 215 C 320 210, 330 215, 325 225" fill="none" strokeWidth="10" />

        <path d="M 180 210 C 190 200, 210 200, 220 210" fill="none" strokeWidth="10" />

        <circle cx="150" cy="215" r="32" fill="var(--color-paper-raised)" strokeWidth="10" />
        <circle cx="250" cy="215" r="32" fill="var(--color-paper-raised)" strokeWidth="10" />
        <circle cx="150" cy="215" r="9" fill="currentColor" />
        <circle cx="250" cy="215" r="9" fill="currentColor" />

        <path d="M 170 260 C 185 280, 215 280, 230 260" fill="none" strokeWidth="9" />

        <path
          d="M 135 305 C 100 350, 70 330, 60 300 C 50 280, 75 270, 85 285 C 95 300, 100 310, 145 350"
          fill="none"
          strokeWidth="11"
        />
        <path d="M 265 305 C 290 340, 305 380, 310 400" fill="none" strokeWidth="11" />
        <path d="M 155 330 L 145 400" fill="none" strokeWidth="11" />
        <path d="M 245 330 L 255 400" fill="none" strokeWidth="11" />

        {variant === 'full' && (
          <g data-part="wordmark" strokeWidth="16">
            <circle cx="85" cy="445" r="23" fill="none" />
            <path
              d="M 75 433 A 12 12 0 0 1 95 433"
              fill="none"
              stroke="var(--color-paper-raised)"
              strokeWidth="4"
            />
            <path d="M 130 420 L 130 475 M 130 450 L 145 450" fill="none" />
            <path d="M 75 490 L 75 510 L 130 510" fill="none" />

            <path
              d="M 180 420 L 180 465 M 215 420 L 215 465 M 180 445 L 215 445 M 180 465 L 215 465"
              fill="none"
            />
            <path d="M 245 420 L 245 475 M 245 450 L 260 450" fill="none" />
            <path d="M 185 510 L 240 510 L 240 525" fill="none" />

            <path d="M 315 420 C 300 450, 280 475, 275 480" fill="none" />
            <path d="M 305 440 C 320 460, 330 475, 340 480" fill="none" />
            <path d="M 365 420 L 365 475 M 365 450 L 380 450" fill="none" />
          </g>
        )}
      </g>
    </svg>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- AnbaksaMark`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/ui/kit/AnbaksaMark.tsx src/ui/kit/AnbaksaMark.test.tsx
git commit -m "feat: 안박사 캐릭터 마크 컴포넌트"
```

---

## Task 3: 휴대폰 음원 선택 고치기

**Files:**
- Create: `src/audio/mimeFromName.ts`
- Modify: `src/ui/settings/AudioDrawer.tsx`
- Test: `src/audio/mimeFromName.test.ts`, `src/ui/settings/AudioDrawer.test.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `guessAudioMime(fileName: string, reportedType: string): string`

휴대폰에서 음원이 회색으로 막히는 이유는 두 군데다.
`accept="audio/*"`가 종류를 `application/octet-stream`으로 보고하는 파일을 막고,
`readAudioDuration`이 그 종류를 그대로 믿어 빈 값이면 실패한다. 한쪽만 고치면 여전히 안 된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/audio/mimeFromName.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { guessAudioMime } from './mimeFromName';

describe('guessAudioMime', () => {
  it('브라우저가 제대로 알려주면 그대로 쓴다', () => {
    expect(guessAudioMime('애국가.mp3', 'audio/mpeg')).toBe('audio/mpeg');
    expect(guessAudioMime('교가.m4a', 'audio/mp4')).toBe('audio/mp4');
  });

  it('종류를 모른다고 하면 확장자로 정한다', () => {
    expect(guessAudioMime('애국가.mp3', '')).toBe('audio/mpeg');
    expect(guessAudioMime('애국가.mp3', 'application/octet-stream')).toBe('audio/mpeg');
  });

  it('주요 확장자를 알아본다', () => {
    expect(guessAudioMime('a.m4a', '')).toBe('audio/mp4');
    expect(guessAudioMime('a.aac', '')).toBe('audio/aac');
    expect(guessAudioMime('a.wav', '')).toBe('audio/wav');
    expect(guessAudioMime('a.ogg', '')).toBe('audio/ogg');
    expect(guessAudioMime('a.oga', '')).toBe('audio/ogg');
    expect(guessAudioMime('a.opus', '')).toBe('audio/ogg');
    expect(guessAudioMime('a.flac', '')).toBe('audio/flac');
  });

  it('대문자 확장자도 알아본다', () => {
    expect(guessAudioMime('애국가.MP3', '')).toBe('audio/mpeg');
  });

  it('점이 여러 개여도 마지막 확장자를 본다', () => {
    expect(guessAudioMime('2026.개학식.교가.wav', '')).toBe('audio/wav');
  });

  it('확장자를 모르면 mp3로 본다', () => {
    expect(guessAudioMime('음원', '')).toBe('audio/mpeg');
    expect(guessAudioMime('음원.xyz', 'application/octet-stream')).toBe('audio/mpeg');
  });

  it('video/로 보고된 mp4 음원도 확장자로 되돌린다', () => {
    expect(guessAudioMime('교가.m4a', 'video/mp4')).toBe('audio/mp4');
  });
});
```

`src/ui/settings/AudioDrawer.test.tsx`에 아래 테스트를 **추가한다** (기존 테스트는 그대로 둔다).
파일 맨 위 import에 `guessAudioMime`은 필요 없다. 기존 파일이 쓰는 도우미(`clearDb`, `listAudio` 등)를 그대로 쓴다.

```tsx
  it('휴대폰처럼 종류를 알려주지 않는 파일도 받아들인다', async () => {
    const user = userEvent.setup();
    render(<AudioDrawer />);

    // 안드로이드 파일 관리자와 카카오톡은 mp3를 종류 없이 넘기는 일이 잦다.
    const file = new File([new Uint8Array([1, 2, 3])], '애국가.mp3', {
      type: 'application/octet-stream',
    });
    await user.upload(screen.getByTestId('file-anthem'), file);

    await waitFor(async () => {
      const saved = await listAudio();
      expect(saved).toHaveLength(1);
      expect(saved[0].mimeType).toBe('audio/mpeg');
    });
  });
```

> 이 테스트는 `readAudioDuration`이 대역으로 바뀌어 있어야 통과한다.
> 기존 `AudioDrawer.test.tsx`가 이미 그렇게 하고 있다면 그대로 두고, 하지 않는다면
> 파일 맨 위에 아래를 넣는다. jsdom에는 진짜 오디오 디코더가 없다.
>
> ```tsx
> vi.mock('../../audio/readAudioDuration', () => ({
>   readAudioDuration: () => Promise.resolve(60),
> }));
> ```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- mimeFromName AudioDrawer`
Expected: FAIL — `mimeFromName` 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/audio/mimeFromName.ts`:

```ts
// 안드로이드 파일 관리자와 카카오톡이 내려받은 mp3는 종류를 application/octet-stream으로
// 보고하는 일이 잦다. 그 값을 그대로 믿으면 재생 길이를 재지 못해 등록이 실패한다.
const BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
};

const FALLBACK = 'audio/mpeg';

export function guessAudioMime(fileName: string, reportedType: string): string {
  if (reportedType.startsWith('audio/')) return reportedType;

  const parts = fileName.toLowerCase().split('.');
  if (parts.length > 1) {
    const found = BY_EXTENSION[parts[parts.length - 1]];
    if (found !== undefined) return found;
  }

  // 확장자도 모르면 mp3로 본다. 대부분 mp3이고, 틀렸다면 재생 시도에서 걸러진다.
  return FALLBACK;
}
```

- [ ] **Step 4: AudioDrawer 고치기**

`src/ui/settings/AudioDrawer.tsx`에서 세 곳을 고친다.

import를 추가한다.

```tsx
import { guessAudioMime } from '../../audio/mimeFromName';
```

`handleFile`이 파일이 보고한 종류 대신 추측한 종류를 쓰게 한다.

```tsx
  async function handleFile(role: AudioRole, file: File) {
    setError('');
    setBusyRole(role);
    try {
      const data = await file.arrayBuffer();
      const mimeType = guessAudioMime(file.name, file.type);
      const durationSec = await readAudioDuration(data, mimeType);
      await putAudio({
        id: newId('audio'),
        role,
        label: file.name,
        data,
        mimeType,
        durationSec,
        fileName: file.name,
        addedAt: Date.now(),
      });
      await reload();
    } catch {
      setError(
        '음원 파일을 읽을 수 없습니다. mp3·m4a·wav 파일인지 확인해 주세요. ' +
          '휴대폰이라면 카카오톡이나 다운로드 폴더에 받아 둔 파일을 골라 주세요.',
      );
    } finally {
      setBusyRole(null);
    }
  }
```

`accept`에 확장자를 함께 적는다. 확장자를 적어야 종류를 잘못 보고하는 파일도 고를 수 있다.

```tsx
                  accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.opus"
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- mimeFromName AudioDrawer`
Expected: PASS

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 6: 커밋**

```bash
git add src/audio/mimeFromName.ts src/audio/mimeFromName.test.ts src/ui/settings/AudioDrawer.tsx src/ui/settings/AudioDrawer.test.tsx
git commit -m "fix: 휴대폰에서 음원 파일이 선택되지 않던 문제"
```

- [ ] **Step 7: 손으로 확인할 목록을 남긴다**

자동 테스트는 파일 선택창 자체를 열어 볼 수 없다. 배포 후 실제 기기에서 확인한다.

- [ ] 안드로이드 크롬 → 설정 → 음원 서랍 → 다운로드 폴더의 mp3가 회색이 아닌지
- [ ] 아이폰 사파리 → 파일 앱의 mp3를 고를 수 있는지
- [ ] 고른 뒤 파일 이름과 재생 길이가 표시되는지
- [ ] 점검 화면의 소리 테스트에서 실제로 들리는지

---

## Task 4: 공유 링크 v2 형식

**Files:**
- Modify: `src/share/scenarioLink.ts`
- Test: `src/share/scenarioLink.test.ts`

**Interfaces:**
- Consumes: `EventCeremony`·`Segment` (계획서 1 Task 1), `newId` (계획서 1 Task 1)
- Produces:
  - `encodeScenario(event)` — v2 배열 형식으로 만든다 (이름·인자는 그대로)
  - `decodeScenario(payload)` — v2와 v1을 모두 읽는다 (이름·인자는 그대로)
  - `MAX_LINK_PAYLOAD`·`buildShareUrl`은 그대로

멘트까지 채운 개학식 한 건이 지금 1,865자다. 원인은 압축률이 아니라 담을 필요가 없는 값들이다 —
순서마다 붙은 내부 id, 순번, 만든·고친 시각. 가져올 때 어차피 새로 만든다.
자리로 뜻을 정하는 배열로 바꾸면 853자가 된다.

이미 배포되어 있어 v1 링크가 밖에 나가 있을 수 있으므로, 읽기는 둘 다 지원한다.

- [ ] **Step 1: v2와 충돌하는 기존 테스트 하나를 고친다**

`src/share/scenarioLink.test.ts:45`의 아래 테스트는 **v2에서 의도적으로 성립하지 않는다.**
v2는 id와 시각을 링크에 담지 않고 해석할 때 새로 만들기 때문이다. 이것이 링크가 짧아지는 이유다.

```ts
  it('압축했다가 풀면 원본과 같다', () => {
    const event = sampleEvent();
    expect(decodeScenario(encodeScenario(event))).toEqual(event);
  });
```

아래로 바꾼다. 지키려는 것은 "객체가 통째로 같다"가 아니라 "내용을 잃지 않는다"이다.

```ts
  it('압축했다가 풀면 내용을 잃지 않는다', () => {
    const event = sampleEvent();
    const restored = decodeScenario(encodeScenario(event));

    // id와 시각은 링크에 담지 않는다. 가져오는 기기에서 새로 만든다.
    const withoutVolatile = (value: typeof event) => ({
      ...value,
      id: '',
      createdAt: 0,
      updatedAt: 0,
      segments: value.segments.map((segment) => ({ ...segment, id: '' })),
    });
    expect(withoutVolatile(restored)).toEqual(withoutVolatile(event));
  });
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/share/scenarioLink.test.ts`의 나머지 기존 `describe` 블록은 그대로 두고, 파일 끝에 아래를 추가한다.
맨 위 import에 `import { compressToEncodedURIComponent } from 'lz-string';`가 이미 있다.

```ts
describe('v2 형식', () => {
  it('멘트까지 채운 개학식 링크가 1000자 아래다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    for (const segment of event.segments) {
      segment.script = `${segment.name} 순서입니다. 모두 자리에서 일어나 주시기 바랍니다.`;
    }
    const url = buildShareUrl(event, 'https://ahnbagsa.github.io', '/event/');
    expect(url.length).toBeLessThan(1000);
  });

  it('id와 시각은 링크에 담지 않는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    const restored = decodeScenario(encodeScenario(event));

    // 가져오는 쪽에서 새로 만드는 값이므로 원본과 같을 필요가 없다.
    expect(restored.segments.map((s) => s.name)).toEqual(event.segments.map((s) => s.name));
    expect(restored.segments.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(restored.segments.every((s) => s.id !== '')).toBe(true);
  });

  it('내용에 관한 값은 하나도 잃지 않는다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '개학식을 시작하겠습니다.';
    event.segments[0].note = '마이크 확인';
    event.segments[0].groupLabel = '국민의례';
    event.segments[1].autoPlay = true;
    event.segments[1].fadeOutSec = 3;
    event.segments[3].timerSec = 45;
    event.segments[4].manualDurationSec = 240;

    const restored = decodeScenario(encodeScenario(event));

    const fields = (list: typeof event.segments) =>
      list.map((s) => [
        s.name, s.kind, s.script, s.groupLabel, s.audioRole,
        s.autoPlay, s.fadeOutSec, s.timerSec, s.manualDurationSec, s.note,
      ]);
    expect(fields(restored.segments)).toEqual(fields(event.segments));
    expect(restored.title).toBe(event.title);
    expect(restored.templateId).toBe(event.templateId);
    expect(restored.date).toBe(event.date);
    expect(restored.place).toBe(event.place);
    expect(restored.mode).toBe(event.mode);
    expect(restored.audience).toBe(event.audience);
    expect(restored.tone).toBe(event.tone);
    expect(restored.targetMinutes).toBe(event.targetMinutes);
  });

  it('직접 만든 음원 역할도 지킨다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].audioRole = 'custom:우리반 노래';
    const restored = decodeScenario(encodeScenario(event));
    expect(restored.segments[0].audioRole).toBe('custom:우리반 노래');
  });

  it('예전에 보낸 v1 링크도 그대로 열린다', () => {
    const event = createEventFromTemplate('semester-opening', init);
    event.segments[0].script = '옛 링크입니다.';
    // v1은 행사 객체를 통째로 JSON으로 만들어 압축했다.
    const v1 = compressToEncodedURIComponent(JSON.stringify(event));

    const restored = decodeScenario(v1);
    expect(restored.title).toBe(event.title);
    expect(restored.segments[0].script).toBe('옛 링크입니다.');
    expect(restored.segments).toHaveLength(event.segments.length);
  });

  it('배열도 객체도 아닌 값은 오류를 던진다', () => {
    const notEvent = compressToEncodedURIComponent(JSON.stringify(42));
    expect(() => decodeScenario(notEvent)).toThrow('시나리오를 읽을 수 없습니다.');
  });

  it('칸이 모자란 v2 배열은 오류를 던진다', () => {
    const broken = compressToEncodedURIComponent(JSON.stringify([2, '제목']));
    expect(() => decodeScenario(broken)).toThrow('시나리오를 읽을 수 없습니다.');
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- scenarioLink`
Expected: FAIL — 링크가 1000자를 넘고, v2 관련 테스트가 실패한다

- [ ] **Step 4: 구현**

`src/share/scenarioLink.ts`를 아래 내용으로 바꾼다.

```ts
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { newId } from '../lib/id';
import type {
  AudioRole,
  EventAudience,
  EventCeremony,
  EventMode,
  EventTone,
  Segment,
  SegmentKind,
} from '../types';

export const MAX_LINK_PAYLOAD = 8192;

// 자리로 뜻을 정한다. 순서를 바꾸면 옛 링크가 깨지므로 뒤에만 덧붙인다.
const MODES: EventMode[] = ['inPerson', 'broadcast'];
const AUDIENCES: EventAudience[] = ['lower', 'upper', 'all', 'withParents'];
const TONES: EventTone[] = ['formal', 'warm', 'concise'];
const KINDS: SegmentKind[] = ['speech', 'audio', 'timer', 'address'];
const ROLES: AudioRole[] = [
  'pledge', 'anthem', 'silence', 'schoolSong', 'entrance', 'exit', 'award',
];

const FAILURE = '시나리오를 읽을 수 없습니다. 링크가 잘린 것 같습니다.';

type Extra = {
  r?: number | string;
  a?: 1;
  t?: number;
  m?: number;
  f?: number;
  g?: string;
  n?: string;
};

function packSegment(segment: Segment): unknown[] {
  const row: unknown[] = [segment.name, KINDS.indexOf(segment.kind), segment.script];
  const extra: Extra = {};

  if (segment.audioRole !== null) {
    const index = ROLES.indexOf(segment.audioRole);
    extra.r = index === -1 ? segment.audioRole : index;
  }
  if (segment.autoPlay) extra.a = 1;
  if (segment.timerSec !== null) extra.t = segment.timerSec;
  if (segment.manualDurationSec !== null) extra.m = segment.manualDurationSec;
  if (segment.fadeOutSec !== null) extra.f = segment.fadeOutSec;
  if (segment.groupLabel !== null) extra.g = segment.groupLabel;
  if (segment.note !== '') extra.n = segment.note;

  if (Object.keys(extra).length > 0) row.push(extra);
  return row;
}

export function encodeScenario(event: EventCeremony): string {
  const packed: unknown[] = [
    2,
    event.title,
    event.templateId,
    event.date,
    event.place,
    MODES.indexOf(event.mode),
    AUDIENCES.indexOf(event.audience),
    TONES.indexOf(event.tone),
    event.targetMinutes,
    event.segments.map(packSegment),
  ];

  const payload = compressToEncodedURIComponent(JSON.stringify(packed));
  if (payload.length > MAX_LINK_PAYLOAD) {
    throw new Error(
      '시나리오가 너무 길어 링크로 보낼 수 없습니다. 멘트를 줄이거나 순서를 나눠 주세요.',
    );
  }
  return payload;
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function pickFromList<T>(list: T[], value: unknown, fallback: T): T {
  return typeof value === 'number' && value >= 0 && value < list.length ? list[value] : fallback;
}

function pickNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function unpackRole(value: unknown): AudioRole | null {
  if (typeof value === 'string') return value as AudioRole;
  if (typeof value === 'number' && value >= 0 && value < ROLES.length) return ROLES[value];
  return null;
}

function unpackSegment(row: unknown, order: number): Segment | null {
  if (!Array.isArray(row) || typeof row[0] !== 'string') return null;
  const extra = (typeof row[3] === 'object' && row[3] !== null ? row[3] : {}) as Extra;

  return {
    id: newId('seg'),
    order,
    name: row[0],
    groupLabel: typeof extra.g === 'string' ? extra.g : null,
    kind: pickFromList(KINDS, row[1], 'speech'),
    script: pickString(row[2], ''),
    audioRole: unpackRole(extra.r),
    autoPlay: extra.a === 1,
    fadeOutSec: pickNumberOrNull(extra.f),
    timerSec: pickNumberOrNull(extra.t),
    manualDurationSec: pickNumberOrNull(extra.m),
    note: typeof extra.n === 'string' ? extra.n : '',
  };
}

function unpackV2(packed: unknown[]): EventCeremony {
  if (packed.length < 10 || !Array.isArray(packed[9])) throw new Error(FAILURE);

  const segments: Segment[] = [];
  for (const row of packed[9]) {
    const segment = unpackSegment(row, segments.length);
    if (segment !== null) segments.push(segment);
  }

  const now = Date.now();
  return {
    id: newId('event'),
    title: pickString(packed[1], '가져온 행사'),
    templateId: pickString(packed[2], 'custom'),
    date: pickString(packed[3], ''),
    place: pickString(packed[4], ''),
    mode: pickFromList(MODES, packed[5], 'inPerson'),
    audience: pickFromList(AUDIENCES, packed[6], 'all'),
    tone: pickFromList(TONES, packed[7], 'formal'),
    targetMinutes: pickNumberOrNull(packed[8]),
    segments,
    createdAt: now,
    updatedAt: now,
  };
}

// 계획서 2에서 쓰던 형식. 이미 내보낸 링크가 있으므로 계속 읽을 수 있어야 한다.
function looksLikeV1(value: unknown): value is EventCeremony {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.segments)
  );
}

export function decodeScenario(payload: string): EventCeremony {
  const failure = new Error(FAILURE);
  if (payload === '') throw failure;

  const json = decompressFromEncodedURIComponent(payload);
  if (json === null || json === '') throw failure;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw failure;
  }

  if (Array.isArray(parsed) && parsed[0] === 2) return unpackV2(parsed);
  if (looksLikeV1(parsed)) return parsed;
  throw failure;
}

export function buildShareUrl(
  event: EventCeremony,
  origin: string,
  pathname: string,
): string {
  return `${origin}${pathname}#/import?d=${encodeScenario(event)}`;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- scenarioLink ImportPage`
Expected: PASS

> `ImportPage`는 가져올 때 `newId('event')`로 id를 새로 주는데, v2는 해석 단계에서 이미 새 id를 준다.
> 두 번 주어도 결과는 같으므로 `ImportPage`는 고치지 않는다.

- [ ] **Step 6: 전체 테스트 확인**

Run: `npm test`
Expected: PASS (전체)

`v2 형식 > 멘트까지 채운 개학식 링크가 1000자 아래다`가 통과하면 링크가 실제로 짧아진 것이다.

- [ ] **Step 7: 커밋**

```bash
git add src/share/scenarioLink.ts src/share/scenarioLink.test.ts
git commit -m "feat: 공유 링크를 절반 이하로 줄인 v2 형식 (v1 링크도 계속 열림)"
```

---

## Task 5: QR 코드와 새 공유 버튼

**Files:**
- Create: `src/ui/share/QrCode.tsx`
- Modify: `src/ui/share/ShareButton.tsx`
- Test: `src/ui/share/QrCode.test.tsx`, `src/ui/share/ShareButton.test.tsx`

**Interfaces:**
- Consumes: `buildShareUrl` (Task 4), `Button`·`Notice` (Task 1)
- Produces:
  - `<QrCode value: string size?: number />` — 못 그리면 `null`을 낸다
  - `<ShareButton event={event} />` — 누르면 링크 복사와 QR을 함께 내놓는다

853자라도 카카오톡에 붙이면 여전히 길다. QR을 함께 보여주면 길이가 상관없어진다.
PC 화면의 QR을 휴대폰 카메라로 찍는 것이 링크의 본래 목적을 가장 빠르게 이룬다.

- [ ] **Step 1: 의존성 설치**

```bash
npm install qrcode-generator
```

> 2.0.4 기준 의존성이 없고 gzip 10.9KB다. 자체 타입(`dist/qrcode.d.ts`)을 포함하므로
> `@types/...`를 따로 설치하지 않는다.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/ui/share/QrCode.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import QrCode from './QrCode';

describe('QrCode', () => {
  it('짧은 값을 QR로 그린다', () => {
    const { container } = render(<QrCode value="https://example.com" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelectorAll('rect').length).toBeGreaterThan(10);
  });

  it('실제 공유 링크 길이(약 850자)도 그린다', () => {
    const { container } = render(
      <QrCode value={`https://ahnbagsa.github.io/event/#/import?d=${'A'.repeat(810)}`} />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('크기를 지정할 수 있다', () => {
    const { container } = render(<QrCode value="짧음" size={320} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '320');
  });

  it('QR 한도를 넘으면 아무것도 그리지 않는다', () => {
    const { container } = render(<QrCode value={'A'.repeat(5000)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('빈 값이면 아무것도 그리지 않는다', () => {
    const { container } = render(<QrCode value="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

`src/ui/share/ShareButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEventFromTemplate } from '../../domain/templates';
import ShareButton from './ShareButton';

const init = {
  title: '2학기 개학식',
  date: '2026-08-18',
  place: '각 교실',
  mode: 'broadcast' as const,
  audience: 'all' as const,
  tone: 'formal' as const,
  targetMinutes: null,
};

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  writeText.mockClear();
  // jsdom의 navigator.clipboard는 getter라 Object.assign으로는 덮이지 않는다.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

describe('ShareButton', () => {
  it('누르면 링크를 복사한다', async () => {
    const user = userEvent.setup();
    render(<ShareButton event={createEventFromTemplate('semester-opening', init)} />);

    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain('#/import?d=');
    expect(await screen.findByText(/링크를 복사했습니다/)).toBeInTheDocument();
  });

  it('복사한 뒤 QR을 함께 보여준다', async () => {
    const user = userEvent.setup();
    render(<ShareButton event={createEventFromTemplate('semester-opening', init)} />);

    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    const panel = await screen.findByTestId('share-panel');
    expect(panel.querySelector('svg')).not.toBeNull();
    expect(panel).toHaveTextContent('휴대폰 카메라로 찍으세요');
  });

  it('닫기를 누르면 사라진다', async () => {
    const user = userEvent.setup();
    render(<ShareButton event={createEventFromTemplate('semester-opening', init)} />);

    await user.click(screen.getByRole('button', { name: '링크 복사' }));
    await screen.findByTestId('share-panel');
    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(screen.queryByTestId('share-panel')).not.toBeInTheDocument();
  });

  it('복사가 막히면 한국어로 안내한다', async () => {
    const user = userEvent.setup();
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<ShareButton event={createEventFromTemplate('semester-opening', init)} />);

    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(await screen.findByText(/복사하지 못했습니다/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- QrCode ShareButton`
Expected: FAIL — `QrCode` 모듈을 찾을 수 없음

- [ ] **Step 4: QrCode 구현**

`src/ui/share/QrCode.tsx`:

```tsx
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

type Props = {
  value: string;
  size?: number;
};

// 오류 정정 수준을 낮게(L) 잡아야 긴 링크가 들어간다. 화면에 띄워 바로 찍는 용도라
// 인쇄물처럼 훼손을 견딜 필요가 없다.
export default function QrCode({ value, size = 280 }: Props) {
  const modules = useMemo(() => {
    if (value === '') return null;
    try {
      const code = qrcode(0, 'L');
      code.addData(value);
      code.make();
      const count = code.getModuleCount();
      const rows: boolean[][] = [];
      for (let row = 0; row < count; row += 1) {
        const cells: boolean[] = [];
        for (let column = 0; column < count; column += 1) {
          cells.push(code.isDark(row, column));
        }
        rows.push(cells);
      }
      return rows;
    } catch {
      // 한도를 넘으면 qrcode-generator가 오류를 던진다.
      return null;
    }
  }, [value]);

  if (modules === null) return null;

  const count = modules.length;
  const quiet = 2;
  const span = count + quiet * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label="시나리오 링크 QR 코드"
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width={span} height={span} fill="#FFFFFF" />
      {modules.map((cells, row) =>
        cells.map((dark, column) =>
          dark ? (
            <rect
              key={`${row}-${column}`}
              x={column + quiet}
              y={row + quiet}
              width="1"
              height="1"
              fill="#000000"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
```

> QR은 검정·흰색 대비가 규격이다. 종이색이나 먹색으로 바꾸면 인식률이 떨어지므로
> 여기서만 토큰을 쓰지 않고 순수한 흑백을 쓴다.

- [ ] **Step 5: ShareButton 다시 쓰기**

`src/ui/share/ShareButton.tsx`를 아래 내용으로 바꾼다.

```tsx
import { useState } from 'react';
import Button from '../kit/Button';
import QrCode from './QrCode';
import { buildShareUrl } from '../../share/scenarioLink';
import type { EventCeremony } from '../../types';

export default function ShareButton({ event }: { event: EventCeremony }) {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleCopy() {
    setError('');
    let built: string;
    try {
      built = buildShareUrl(event, window.location.origin, window.location.pathname);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '링크를 만들지 못했습니다.');
      return;
    }

    setUrl(built);
    try {
      await navigator.clipboard.writeText(built);
      setMessage('링크를 복사했습니다. 휴대폰으로 보내세요.');
    } catch {
      setMessage('');
      setError('링크를 복사하지 못했습니다. 아래 QR을 휴대폰으로 찍어 주세요.');
    }
  }

  function handleClose() {
    setUrl('');
    setMessage('');
    setError('');
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <Button variant="ghost" onClick={() => void handleCopy()}>링크 복사</Button>

      {url !== '' && (
        <div data-testid="share-panel"
             className="rounded-2xl border border-line bg-paper-raised p-4 text-sm">
          {message !== '' && <p className="mb-2 text-ok">{message}</p>}
          {error !== '' && <p className="mb-2 text-danger">{error}</p>}

          <QrCode value={url} />
          <p className="mt-2 text-ink-soft">휴대폰 카메라로 찍으세요</p>

          <Button className="mt-2" onClick={handleClose}>닫기</Button>
        </div>
      )}

      {url === '' && error !== '' && <span className="text-sm text-danger">{error}</span>}
    </span>
  );
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- QrCode ShareButton`
Expected: PASS (9 tests)

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: 타입 오류 없음. 번들이 15KB 이상 늘지 않는다

- [ ] **Step 7: 커밋**

```bash
git add package.json package-lock.json src/ui/share
git commit -m "feat: 공유 링크 QR 코드"
```

---

## Task 6: 홈 화면과 새 행사 화면

**Files:**
- Modify: `src/ui/Home.tsx`, `src/ui/NewEventPage.tsx`, `src/ui/InstallHint.tsx`
- Test: 기존 `src/ui/Home.test.tsx`, `src/ui/NewEventPage.test.tsx`, `src/ui/InstallHint.test.tsx`가 그대로 통과해야 한다

**Interfaces:**
- Consumes: `Button`·`Card`·`Notice`·`AnbaksaMark` (Task 1·2)
- Produces: 없음 (화면만 바뀐다)

- [ ] **Step 1: 홈 화면 고치기**

`src/ui/Home.tsx`에서 다음을 바꾼다. **글자는 하나도 바꾸지 않는다.**

머리말에 안박사를 세운다.

```tsx
      <header className="mb-4 flex items-center gap-3">
        <AnbaksaMark size={40} className="shrink-0 text-ink" />
        <h1 className="flex-1 text-2xl font-bold">행사박사</h1>
        <Link to="/settings" className="text-accent">설정</Link>
      </header>
```

`＋ 새 행사 만들기` 링크를 강조색 알약으로 바꾼다.

```tsx
      <Link to="/new"
            className="mb-4 flex h-12 items-center justify-center rounded-full bg-accent px-4 text-center font-medium text-white hover:bg-accent-strong">
        ＋ 새 행사 만들기
      </Link>
```

행사 카드를 `Card`로 감싼다. `key`와 액션 줄의 글자는 그대로 둔다.

```tsx
          <Card as="li" key={event.id}>
            <p className="font-medium">{event.title}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {event.date} · {event.place} · 순서 {event.segments.length}개 · 예상{' '}
              {formatDuration(estimateTotalSeconds(event.segments, durations))}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Link to={`/event/${event.id}/edit`} className="text-accent">편집</Link>
              <Link to={`/event/${event.id}/preflight`} className="text-accent">진행</Link>
              <ShareButton event={event} />
              {confirmId === event.id ? (
                <>
                  <button className="text-danger"
                          onClick={() => void handleDelete(event.id)}>정말 삭제</button>
                  <button onClick={() => setConfirmId(null)}>취소</button>
                </>
              ) : (
                <button className="text-danger"
                        onClick={() => setConfirmId(event.id)}>삭제</button>
              )}
            </div>
          </Card>
```

"아직 만든 행사가 없습니다."와 "불러오는 중입니다…"는 `text-ink-soft`로 바꾼다.

- [ ] **Step 2: 크레딧 넣기**

`Home.tsx`의 `</ul>` 바로 뒤, `</main>` 앞에 넣는다.

```tsx
      <footer className="mt-10 flex flex-col items-center gap-1 pb-6 text-ink-soft">
        <AnbaksaMark variant="full" size={48} title="안박사" className="text-ink-soft" />
        <p className="text-sm">만든 이 · 안박사</p>
      </footer>
```

- [ ] **Step 3: 새 행사 화면 고치기**

`src/ui/NewEventPage.tsx`:

- 머리말을 `<PageHeader title="새 행사 만들기" backTo="/" backLabel="← 홈" />`으로 바꾼다
- 계획서 뽑기 링크의 `border-blue-400 text-blue-700`을 `border-accent text-accent hover:bg-accent-soft`로, 모서리를 `rounded-2xl`로 바꾼다
- 입력칸 공통 클래스(`field`)를 `w-full rounded-xl border border-line bg-paper-raised px-3 py-2`로 바꾼다
- 만들기 버튼을 `<Button variant="primary" size="lg" className="w-full" ...>`로 바꾼다
- 진행 방식 `fieldset`의 `border-blue-400`을 `border-accent`로 바꾼다

- [ ] **Step 4: 설치 안내 고치기**

`src/ui/InstallHint.tsx`의 바깥 `div`를 `Notice`로 바꾼다. **글자는 그대로 둔다.**

```tsx
  return (
    <Notice tone="warn" className="mb-4">
      <p className="font-medium">📱 휴대폰으로 행사를 진행하시려면 먼저 설치해 주세요</p>
      {/* 이하 기존 내용 그대로 */}
    </Notice>
  );
```

- [ ] **Step 5: 테스트와 빌드 확인**

Run: `npm test`
Expected: PASS (전체). 실패하면 그 테스트가 겉모습에 기대고 있었다는 뜻이므로 함께 고친다

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add src/ui/Home.tsx src/ui/NewEventPage.tsx src/ui/InstallHint.tsx
git commit -m "feat: 홈 화면에 안박사 마크와 만든 이 표시, 새 결 적용"
```

---

## Task 7: 설정 화면

**Files:**
- Modify: `src/ui/settings/SettingsPage.tsx`, `ProfileForm.tsx`, `AudioDrawer.tsx`, `StorageNotice.tsx`, `ApiKeyForm.tsx`
- Test: 기존 설정 관련 테스트가 그대로 통과해야 한다

**Interfaces:**
- Consumes: `Button`·`Card`·`Notice`·`PageHeader` (Task 1)
- Produces: 없음

- [ ] **Step 1: 각 화면 고치기**

**`SettingsPage.tsx`** — 머리말을 `<PageHeader title="설정" backTo="/" backLabel="← 홈" />`으로 바꾼다. 나머지는 그대로.

**`ProfileForm.tsx`·`ApiKeyForm.tsx`** — 입력칸을 `w-full rounded-xl border border-line bg-paper-raised px-3 py-2`로,
버튼을 `<Button variant="primary">`로, 설명 글씨를 `text-ink-soft`로, 성공 글씨를 `text-ok`로, 오류를 `text-danger`로 바꾼다.

**`ApiKeyForm.tsx`의 연결 테스트 결과 상자** — `border-gray-300`을 `border-line`으로, 모서리를 `rounded-2xl`로 바꾼다.
`data-testid="test-report"`는 그대로 둔다.

**`AudioDrawer.tsx`** — `Card`는 `data-testid`를 받지 않으므로 여기서는 쓰지 않는다.
기존 `<li>`를 그대로 두고 클래스만 `rounded-2xl border border-line bg-paper-raised p-4`로 바꾼다.
`data-testid={`slot-${role}`}`와 `aria-label`은 그대로 둔다.
삭제 버튼은 `text-danger`, 설명 글씨는 `text-ink-soft`, 오류는 `text-danger`로 바꾼다.
Task 3에서 고친 `accept`와 `handleFile`은 건드리지 않는다.

**`StorageNotice.tsx`** — 안내 상자를 `Notice`로 바꾼다. 글자와 `data-testid`는 그대로 둔다.

- [ ] **Step 2: 테스트와 빌드 확인**

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add src/ui/settings
git commit -m "feat: 설정 화면에 새 결 적용"
```

---

## Task 8: 편집기

**Files:**
- Modify: `src/ui/editor/EditorPage.tsx`, `SegmentCard.tsx`, `ScriptField.tsx`
- Test: 기존 편집기 테스트가 그대로 통과해야 한다

**Interfaces:**
- Consumes: `Button`·`Notice`·`PageHeader` (Task 1)
- Produces: 없음

- [ ] **Step 1: 편집기 고치기**

**`EditorPage.tsx`**

- 붙어 있는 상단 바(`sticky top-0`)의 `border-gray-300 bg-white`를 `border-line bg-paper`로 바꾼다
- `저장` 버튼을 `<Button variant="primary">저장</Button>`으로 바꾼다
- `점검하러 가기 →` 링크를 `text-accent`로 바꾼다
- 빈칸 경고(`bg-yellow-200`)를 `bg-warn-soft text-warn rounded-full px-2`로 바꾼다. `data-testid="blank-warning"`은 그대로
- 저장 완료(`text-green-700`)를 `text-ok`로 바꾼다
- AI 줄의 `bg-emerald-600` 버튼을 `<Button variant="primary">`로 바꾼다. **글자는 그대로 둔다** (`AI로 멘트 채우기` / `멘트를 쓰는 중입니다…`)
- AI 오류 글씨를 `text-danger`로 바꾼다
- `＋ 순서 추가`와 팔레트 버튼들을 `<Button>`으로 바꾼다. 글자는 그대로

**`SegmentCard.tsx`**

- 바깥 `<li>`의 `rounded border-gray-300`을 `rounded-2xl border-line bg-paper-raised`로 바꾼다. `data-testid`는 그대로
- 위로·아래로·펼치기 버튼을 `text-ink-soft hover:text-ink`로, 삭제를 `text-danger`로 바꾼다
- 입력칸·선택칸을 `rounded-xl border border-line bg-paper-raised px-3 py-2`로 바꾼다
- `🔄 이 순서만 다시 생성`을 `<Button variant="secondary">`로 바꾼다. **글자는 그대로 둔다**
- 음원 없음 경고(`text-red-600`)를 `text-danger`로 바꾼다

**`ScriptField.tsx`**

- 여러 줄 입력칸을 `rounded-xl border border-line bg-paper-raised p-3 text-base`로 바꾼다
- 빈칸 표시가 강조되어 있다면 색만 `bg-warn-soft text-warn`으로 바꾼다
- **`사회자 멘트` 라벨 글자를 바꾸지 않는다.** 여러 테스트가 이 글자로 요소를 찾는다

- [ ] **Step 2: 테스트와 빌드 확인**

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add src/ui/editor
git commit -m "feat: 편집기에 새 결 적용"
```

---

## Task 9: 마법사와 가져오기 화면

**Files:**
- Modify: `src/ui/wizard/ImportPlanPage.tsx`, `src/ui/wizard/OutlineReviewPage.tsx`, `src/ui/share/ImportPage.tsx`
- Test: 기존 `OutlineReviewPage.test.tsx`, `ImportPage.test.tsx`가 그대로 통과해야 한다

**Interfaces:**
- Consumes: `Button`·`Notice`·`PageHeader` (Task 1)
- Produces: 없음

- [ ] **Step 1: 각 화면 고치기**

**`ImportPlanPage.tsx`**

- 머리말을 `<PageHeader title="계획서에서 식순 뽑기" backTo="/new" backLabel="← 뒤로" />`로 바꾼다
- 여러 줄 입력칸을 `w-full rounded-xl border border-line bg-paper-raised p-3`로 바꾼다
- hwp 안내를 `Notice tone="warn"`으로 감싼다. **글자는 그대로 둔다**
- 오류를 `text-danger`로, 뽑아내기 버튼을 `<Button variant="primary" size="lg" className="w-full">`로 바꾼다.
  **글자는 그대로 둔다** (`식순 뽑아내기` / `식순을 읽는 중입니다…`)

**`OutlineReviewPage.tsx`**

- 머리말을 `<PageHeader title="식순 확인" backTo="/new/plan" backLabel="← 다시 넣기" />`로 바꾼다
- 식순을 못 찾았을 때의 `bg-amber-100` 상자를 `Notice tone="warn"`으로 바꾼다. **글자는 그대로 둔다**
- 순서 줄(`data-testid="outline-row"`)의 `rounded border-gray-300`을 `rounded-xl border-line bg-paper-raised`로 바꾼다.
  `data-testid`와 `aria-label`은 그대로 둔다
- `field` 클래스를 `w-full rounded-xl border border-line bg-paper-raised px-3 py-2`로 바꾼다
- 진행 방식 `fieldset`의 `border-blue-400`을 `border-accent`로, 모서리를 `rounded-2xl`로 바꾼다
- `＋ 순서 추가`와 `이 식순으로 행사 만들기`를 `<Button>`으로 바꾼다. **글자는 그대로 둔다**
- 삭제 버튼을 `text-danger`로 바꾼다

**`ImportPage.tsx`**

- 없는 음원 경고(`bg-amber-100`, `data-testid="missing-audio"`)를 `<Notice tone="warn" data-testid="missing-audio">`로 바꾼다.
  **글자와 `data-testid`는 그대로 둔다**
- `이 기기에 가져오기`를 `<Button variant="primary" size="lg" className="w-full">`로 바꾼다. **글자는 그대로 둔다**
- 오류 글씨를 `text-danger`로, 보조 설명을 `text-ink-soft`로, 링크를 `text-accent`로 바꾼다

- [ ] **Step 2: 테스트와 빌드 확인**

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add src/ui/wizard src/ui/share/ImportPage.tsx
git commit -m "feat: 계획서 넣기·식순 확인·가져오기 화면에 새 결 적용"
```

---

## Task 10: 점검 화면과 진행 화면

**Files:**
- Modify: `src/ui/preflight/PreflightPage.tsx`, `src/ui/run/RunPage.tsx`
- Test: 기존 `PreflightPage.test.tsx`, `RunPage.test.tsx`가 그대로 통과해야 한다

**Interfaces:**
- Consumes: `Button`·`Notice`·`PageHeader` (Task 1)
- Produces: 없음

진행 화면은 이미 어두운 배경(`slate-900`)을 쓴다. 차가운 회색 대신 따뜻한 검정(`stage`)으로 바꿔
나머지 화면과 같은 계열로 만든다. 대비는 지금보다 낮아지지 않아야 한다.

- [ ] **Step 1: 점검 화면 고치기**

`src/ui/preflight/PreflightPage.tsx`:

- 머리말을 `<PageHeader title="행사 전 점검" backTo="/" backLabel="← 홈" />`으로 바꾼다.
  기존 제목 글자가 다르면 **기존 글자를 그대로 쓴다** (테스트가 찾는다)
- 통과 항목을 `text-ok`, 막힌 항목을 `text-danger`로 바꾼다
- 경고 상자를 `Notice`로 바꾼다. `data-testid`와 글자는 그대로 둔다
- `진행 시작`과 소리 테스트 버튼을 `<Button>`으로 바꾼다. **글자는 그대로 둔다**
- 항목 칸의 테두리를 `border-line`, 모서리를 `rounded-2xl`로 바꾼다

- [ ] **Step 2: 진행 화면 고치기**

`src/ui/run/RunPage.tsx`에서 색만 바꾼다. **구조와 글자는 건드리지 않는다.**

| 지금 | 바꿀 값 |
|---|---|
| `bg-slate-900` | `bg-stage` |
| `text-white` | `text-paper` |
| `text-slate-300`, `text-slate-400` | `text-white/70` |
| `border-slate-700`, `border-slate-600` | `border-white/20` |
| `bg-blue-600` | `bg-accent` |
| `text-red-400` | `text-danger` → 어두운 배경에서 어두운 빨강은 읽기 어렵다. `text-red-300`을 쓴다 |

`html`·`body`가 종이색이므로 진행 화면 바깥이 비쳐 보이지 않도록 최상위 `<main>`에 `min-h-screen`이 이미 있는지 확인하고, 없으면 넣는다.

- [ ] **Step 3: 테스트와 빌드 확인**

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add src/ui/preflight src/ui/run
git commit -m "feat: 점검·진행 화면에 새 결 적용"
```

---

## Task 11: 앱 아이콘과 테마색

**Files:**
- Modify: `public/icon-192.png`, `public/icon-512.png`, `vite.config.ts`, `index.html`
- Test: 없음 (눈으로 확인한다)

**Interfaces:**
- Consumes: `AnbaksaMark`의 SVG 경로 (Task 2)
- Produces: 없음

지금 아이콘은 파란 바탕에 "행" 글씨다. 새 색과 맞지 않고, 안박사가 있는데 글씨를 쓸 이유가 없다.

- [ ] **Step 1: 아이콘 만들 임시 페이지 작성**

계획서 2에서 쓴 System.Drawing으로는 SVG 경로를 그릴 수 없고, 그림 변환 라이브러리를 새로 들이지 않는다.
브라우저에 그려 뽑는다.

`tools/make-icon.html`을 만든다.

```html
<!doctype html>
<html lang="ko">
  <head><meta charset="UTF-8" /><title>아이콘 만들기</title></head>
  <body>
    <div id="out"></div>
    <script>
      // 안박사 얼굴만. AnbaksaMark의 mark viewBox와 같은 값을 쓴다.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 20 330 400" width="SIZE" height="SIZE">
        <rect x="40" y="20" width="330" height="400" fill="#FDFBF6"/>
        <g stroke="#1B1917" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 120 100 C 120 140, 280 140, 280 100 Z" fill="#1B1917"/>
          <polygon points="200,40 320,75 200,110 80,75" fill="#1B1917" stroke-width="10"/>
          <path d="M 285 85 L 285 120" fill="none" stroke-width="5"/>
          <polygon points="280,120 290,120 295,145 275,145" fill="#1B1917" stroke-width="2"/>
          <circle cx="200" cy="220" r="105" fill="#FFFFFF" stroke-width="12"/>
          <path d="M 100 215 C 80 210, 70 215, 75 225" fill="none" stroke-width="10"/>
          <path d="M 300 215 C 320 210, 330 215, 325 225" fill="none" stroke-width="10"/>
          <path d="M 180 210 C 190 200, 210 200, 220 210" fill="none" stroke-width="10"/>
          <circle cx="150" cy="215" r="32" fill="#FFFFFF" stroke-width="10"/>
          <circle cx="250" cy="215" r="32" fill="#FFFFFF" stroke-width="10"/>
          <circle cx="150" cy="215" r="9" fill="#1B1917"/>
          <circle cx="250" cy="215" r="9" fill="#1B1917"/>
          <path d="M 170 260 C 185 280, 215 280, 230 260" fill="none" stroke-width="9"/>
          <path d="M 135 305 C 100 350, 70 330, 60 300 C 50 280, 75 270, 85 285 C 95 300, 100 310, 145 350" fill="none" stroke-width="11"/>
          <path d="M 265 305 C 290 340, 305 380, 310 400" fill="none" stroke-width="11"/>
          <path d="M 155 330 L 145 400" fill="none" stroke-width="11"/>
          <path d="M 245 330 L 255 400" fill="none" stroke-width="11"/>
        </g>
      </svg>`;

      async function draw(size) {
        const source = svg.replaceAll('SIZE', String(size));
        const image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FDFBF6';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(image, 0, 0, size, size);
        const box = document.createElement('div');
        box.id = 'data-' + size;
        box.textContent = canvas.toDataURL('image/png');
        box.style.cssText = 'word-break:break-all;font-size:8px;display:none';
        document.body.appendChild(box);
        document.getElementById('out').appendChild(canvas);
      }

      Promise.all([draw(192), draw(512)]).then(() => {
        document.title = '완료';
      });
    </script>
  </body>
</html>
```

- [ ] **Step 2: 브라우저에서 열어 PNG 뽑기**

```bash
npm run dev
```

크롬으로 `http://localhost:5173/tools/make-icon.html`을 연다.
개발자도구 콘솔에서 두 값을 각각 복사한다.

```js
copy(document.getElementById('data-192').textContent)
copy(document.getElementById('data-512').textContent)
```

복사한 값을 파일로 저장한다 (`<붙여넣기>` 자리에 data URL을 넣는다).

```bash
node -e "
const fs=require('fs');
const url=process.argv[1];
const base64=url.slice(url.indexOf(',')+1);
fs.writeFileSync(process.argv[2], Buffer.from(base64,'base64'));
console.log(process.argv[2], fs.statSync(process.argv[2]).size, '바이트');
" "<붙여넣기>" public/icon-192.png
```

512도 같은 방법으로 저장한다.

- [ ] **Step 3: 아이콘 눈으로 확인**

두 파일을 열어 종이색 바탕에 먹색 안박사 얼굴이 또렷한지 본다.
192px에서 안경과 눈이 뭉개지면 `viewBox`를 `60 30 290 340`으로 좁혀 얼굴을 키우고 다시 뽑는다.

- [ ] **Step 4: 테마색 바꾸기**

`vite.config.ts`의 매니페스트에서 두 값을 바꾼다.

```ts
        background_color: '#FDFBF6',
        theme_color: '#C75B2A',
```

`index.html`의 테마색도 맞춘다.

```html
    <meta name="theme-color" content="#C75B2A" />
```

- [ ] **Step 5: 임시 페이지 지우기**

```bash
rm tools/make-icon.html
rmdir tools
```

한 번 쓰고 버리는 도구다. 저장소에 남기지 않는다.

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: `dist/icon-192.png`·`dist/icon-512.png`가 새 그림으로 바뀌고, `dist/manifest.webmanifest`의 색이 바뀐다

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('dist/manifest.webmanifest','utf8')))"
```

- [ ] **Step 7: 커밋**

```bash
git add public/icon-192.png public/icon-512.png vite.config.ts index.html
git commit -m "feat: 앱 아이콘을 안박사로 바꾸고 테마색 맞춤"
```

---

## Task 12: 전체 점검과 배포

**Files:** 없음 (확인만 한다)

- [ ] **Step 1: 전체 테스트와 빌드**

Run: `npm test`
Expected: PASS (전체)

Run: `npm run build`
Expected: 타입 오류 없음

- [ ] **Step 2: 옛 색이 남아 있지 않은지 확인**

```bash
grep -rn "blue-600\|slate-900\|gray-600\|gray-300\|gray-400\|gray-500\|amber-100\|yellow-200\|green-700\|red-600\|emerald-600" src --include=*.tsx | grep -v "\.test\."
```

Expected: 아무것도 나오지 않는다. 남아 있으면 Task 6~10에서 빠뜨린 것이므로 고친다.

- [ ] **Step 3: 화면을 눈으로 확인**

```bash
npm run dev
```

`http://localhost:5173`에서 확인한다.

- [ ] 홈 — 안박사 마크가 제목 옆에, 크레딧이 맨 아래에 있는지
- [ ] 홈 — 링크 복사를 누르면 QR이 뜨는지
- [ ] 설정 — 세 묶음(프로필·음원·AI)의 결이 같은지
- [ ] 편집기 — 상단 바가 종이색으로 붙어 있는지
- [ ] 진행 모드 — 따뜻한 검정 배경에 글씨가 또렷한지
- [ ] 휴대폰 크기(개발자도구 375px)에서 버튼이 넘치지 않는지

- [ ] **Step 4: 커밋과 배포 요청**

고칠 것이 있었다면 커밋한다. 없으면 넘어간다.

**푸시는 사용자가 직접 해야 한다.** 이 컴퓨터에 git 자격 증명이 없어 에이전트가 push하면 로그인 창을 띄우지 못하고 멈춘다.
사용자에게 아래를 요청한다.

```
! git push
```

- [ ] **Step 5: 배포 후 손으로 확인**

- [ ] Actions가 초록색으로 끝났는지
- [ ] `https://ahnbagsa.github.io/event/`에서 새 디자인이 보이는지
- [ ] 휴대폰에서 홈 화면에 다시 추가했을 때 안박사 아이콘이 나오는지
- [ ] **안드로이드·아이폰에서 음원 파일이 회색이 아니고 실제로 등록되는지** (Task 3의 핵심)
- [ ] PC에서 링크 복사 → QR을 휴대폰으로 찍어 가져오기가 되는지
- [ ] 계획서 2 때 만든 옛 링크가 아직 있다면 그것도 열리는지 (v1 하위호환)

---

## 완료 기준

- 모든 화면이 같은 색·간격·모양 규칙을 따른다. `grep`에 옛 Tailwind 기본 색이 잡히지 않는다.
- 첫 화면에 안박사가 있고, 맨 아래에 만든 이가 표시된다.
- 휴대폰에서 음원 파일을 고르고 등록할 수 있다.
- 공유 링크가 1,000자 아래이고, QR로도 옮길 수 있으며, 예전 링크도 열린다.
- 기존 테스트 299개와 새 테스트가 모두 통과한다.

## 자체 점검 결과

**설계서 반영 확인**

| 설계서 항목 | 담당 작업 |
|---|---|
| 2절 색 토큰 | Task 1 |
| 3절 공통 부품 | Task 1 |
| 4절 안박사 마크와 크레딧 | Task 2 · Task 6 |
| 5절 화면별 적용 | Task 6·7·8·9·10 |
| 6절 휴대폰 음원 선택 | Task 3 |
| 7절 링크 v2 형식 | Task 4 |
| 7절 QR 코드 | Task 5 |
| 8절 PWA 아이콘·테마색 | Task 11 |
| 9절 테스트 | 각 Task의 테스트 단계 + Task 12 |
| 10절 하지 않는 것 | 어느 작업에도 넣지 않았다 |

**주의할 점**

- Task 1의 색 토큰이 들어가기 전에 Task 6~10을 하면 클래스 이름이 존재하지 않아 아무 색도 나오지 않는다. **Task 1을 반드시 먼저 한다.**
- Task 3·4·5는 서로 독립이고 디자인 작업과도 독립이다. 순서를 바꿔도 되지만, Task 5는 Task 1(Button)과 Task 4(짧은 링크)에 기댄다.
- 화면 작업(Task 6~10)에서 **글자를 바꾸면 테스트가 깨진다.** 테스트가 글자로 요소를 찾기 때문이다. 색과 모양만 바꾼다.
- Task 11의 아이콘 뽑기는 자동화하지 않았다. 그림 변환 라이브러리를 들이는 비용이 한 번 쓰는 도구에 비해 크다.
