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
    // 좁은 폰에서 오른쪽 내용이 아랫줄로 흐른다. 한 줄로 묶어 두면 제목이 잘린다.
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 glass sticky top-0 z-10 border-b border-white/80 px-4 py-3 shadow-soft">
      {backTo !== undefined && (
        <Link to={backTo} className="shrink-0 rounded-full bg-white/75 px-3 py-1 text-sm font-medium text-accent shadow-soft hover:bg-accent-soft">{backLabel}</Link>
      )}
      {/* min-w-40 이 있어야 좁은 화면에서 오른쪽 내용이 아랫줄로 내려간다.
          없으면 오른쪽이 자리를 먼저 차지하고 제목이 세로로 길게 접힌다. */}
      <h1 className="min-w-40 flex-1 text-lg font-bold">{title}</h1>
      {right !== undefined && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
