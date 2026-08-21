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
