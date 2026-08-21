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
