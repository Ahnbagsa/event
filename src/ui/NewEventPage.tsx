import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TEMPLATES, createEventFromTemplate } from '../domain/templates';
import { putEvent } from '../db/eventRepo';
import type { EventAudience, EventMode, EventTone } from '../types';

const AUDIENCES: { value: EventAudience; label: string }[] = [
  { value: 'lower', label: '저학년 (1~2학년)' },
  { value: 'upper', label: '고학년' },
  { value: 'all', label: '전교생' },
  { value: 'withParents', label: '학부모·내빈 참석' },
];

const TONES: { value: EventTone; label: string }[] = [
  { value: 'formal', label: '정중하게' },
  { value: 'warm', label: '따뜻하게' },
  { value: 'concise', label: '간결하게' },
];

export default function NewEventPage() {
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState('semester-opening');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [place, setPlace] = useState('강당');
  const [mode, setMode] = useState<EventMode>('inPerson');
  const [audience, setAudience] = useState<EventAudience>('all');
  const [tone, setTone] = useState<EventTone>('formal');
  const [targetMinutes, setTargetMinutes] = useState('');
  const [error, setError] = useState('');

  const field = 'w-full rounded-xl border border-line px-3 py-2';

  async function handleCreate() {
    if (title.trim() === '') {
      setError('행사 제목을 입력해 주세요.');
      return;
    }
    setError('');
    const event = createEventFromTemplate(templateId, {
      title: title.trim(),
      date,
      place: place.trim(),
      mode,
      audience,
      tone,
      targetMinutes: targetMinutes === '' ? null : Number(targetMinutes),
    });
    await putEvent(event);
    navigate(`/event/${event.id}/edit`);
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4 pb-16">
      <header className="flex items-center gap-3">
        <Link to="/" className="text-accent">← 홈</Link>
        <h1 className="text-lg font-bold">새 행사 만들기</h1>
      </header>

      <Link to="/new/plan"
            className="block rounded-xl border border-accent p-3 text-center text-accent">
        📄 계획서 파일이나 붙여넣은 글에서 식순 뽑기
      </Link>

      <div>
        <label className="block text-sm font-medium" htmlFor="templateId">행사 종류</label>
        <select id="templateId" className={field} value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}>
          {TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>{template.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="title">행사 제목</label>
        <input id="title" className={field} value={title}
               onChange={(e) => setTitle(e.target.value)}
               placeholder="2026학년도 2학기 개학식" />
      </div>

      {/* 좁은 폰에서는 위아래로 쌓고 넓어지면 두 칸이 된다. flex + flex-1로 두면
          아이폰의 날짜 입력칸이 장소칸 위로 올라타 테두리가 겹친다. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="block text-sm font-medium" htmlFor="date">날짜</label>
          <input id="date" type="date" className={field} value={date}
                 onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label className="block text-sm font-medium" htmlFor="place">장소</label>
          <input id="place" className={field} value={place}
                 onChange={(e) => setPlace(e.target.value)} />
        </div>
      </div>

      <fieldset className="rounded-xl border border-accent p-3">
        <legend className="px-1 text-sm font-medium">진행 방식</legend>
        <p className="mb-2 text-sm text-ink-soft">
          이 선택에 따라 사회자 멘트가 크게 달라집니다.
        </p>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === 'inPerson'}
                 onChange={() => setMode('inPerson')} />
          강당 등에서 대면 진행
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === 'broadcast'}
                 onChange={() => setMode('broadcast')} />
          교실 방송으로 진행
        </label>
      </fieldset>

      <div>
        <label className="block text-sm font-medium" htmlFor="audience">대상</label>
        <select id="audience" className={field} value={audience}
                onChange={(e) => setAudience(e.target.value as EventAudience)}>
          {AUDIENCES.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="tone">멘트 톤</label>
        <select id="tone" className={field} value={tone}
                onChange={(e) => setTone(e.target.value as EventTone)}>
          {TONES.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="targetMinutes">
          목표 소요 시간(분, 선택)
        </label>
        <input id="targetMinutes" type="number" className={field} value={targetMinutes}
               onChange={(e) => setTargetMinutes(e.target.value)} placeholder="20" />
      </div>

      {error !== '' && <p className="text-danger">{error}</p>}

      <button className="w-full rounded-full bg-accent font-semibold px-4 py-3 text-white"
              onClick={() => void handleCreate()}>
        행사 만들기
      </button>
    </main>
  );
}
