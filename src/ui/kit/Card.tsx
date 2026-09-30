import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  as?: 'div' | 'li';
  className?: string;
};

export default function Card({ children, as: Tag = 'div', className = '' }: Props) {
  return (
    <Tag className={`rounded-card border border-white/90 bg-paper-raised p-4 shadow-soft ${className}`}>
      {children}
    </Tag>
  );
}
