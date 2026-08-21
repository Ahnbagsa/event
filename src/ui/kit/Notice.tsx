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
