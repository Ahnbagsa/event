import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white disabled:bg-line disabled:text-ink-soft',
  secondary:
    'border border-white bg-white/80 text-ink shadow-soft hover:bg-accent-soft hover:text-accent-strong disabled:text-ink-soft',
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
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
