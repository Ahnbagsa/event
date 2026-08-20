import { findBlanks } from '../../domain/blanks';

type Props = {
  id: string;
  value: string;
  onChange: (next: string) => void;
};

export default function ScriptField({ id, value, onChange }: Props) {
  const blanks = findBlanks(value);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium" htmlFor={id}>사회자 멘트</label>
      <textarea
        id={id}
        className="w-full rounded border border-gray-400 p-2"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {blanks.length > 0 && (
        <p className="text-sm">
          <span className="rounded bg-yellow-200 px-1">채워야 할 빈칸</span>{' '}
          {blanks.join(', ')}
        </p>
      )}
    </div>
  );
}
