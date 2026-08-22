import type { ButtonHTMLAttributes } from 'react';

type Tone = 'ink' | 'accent' | 'danger';

const TONES: Record<Tone, string> = {
  ink: 'text-ink hover:bg-accent-soft',
  accent: 'text-accent hover:bg-accent-soft',
  danger: 'text-danger hover:bg-danger-soft',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
};

/**
 * 글자만 있는 작은 버튼(▲ ▼ 삭제 펼치기)에 손가락이 닿을 넓이를 준다.
 * px-2만 주면 세로 터치 영역이 글자 높이만 해서 휴대폰에서 잘 눌리지 않는다.
 * 최소 44×44px은 애플이 권장하는 크기다.
 */
export default function IconButton({
  tone = 'ink',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      data-tone={tone}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-2 transition-colors disabled:cursor-not-allowed disabled:text-ink-soft ${TONES[tone]} ${className}`}
      {...rest}
    />
  );
}
