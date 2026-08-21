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
