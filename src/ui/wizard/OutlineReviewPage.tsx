import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearPlanDraft, loadPlanDraft } from './planDraft';
import { createEventFromSeeds, type SegmentSeed } from '../../domain/templates';
import { putEvent } from '../../db/eventRepo';
import type { EventAudience, EventMode, EventTone, SegmentKind } from '../../types';

const KINDS: { value: SegmentKind; label: string }[] = [
  { value: 'speech', label: '멘트만' },
  { value: 'audio', label: '음원 재생' },
  { value: 'timer', label: '묵념 등 시간' },
  { value: 'address', label: '말씀·전달' },
];

function blankSeed(): SegmentSeed {
  return {
    name: '',
    groupLabel: null,
    kind: 'speech',
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
  };
}

export default function OutlineReviewPage() {
  const navigate = useNavigate();
  const [seeds, setSeeds] = useState<SegmentSeed[] | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [place, setPlace] = useState('');
  const [mode, setMode] = useState<EventMode>('inPerson');
  const [audience, setAudience] = useState<EventAudience>('all');
  const [tone, setTone] = useState<EventTone>('formal');
  const [error, setError] = useState('');

  useEffect(() => {
    const draft = loadPlanDraft();
    if (draft === null) return;
    setSeeds(draft.seeds);
    setTitle(draft.title ?? '');
    if (draft.date !== null) setDate(draft.date);
    setPlace(draft.place ?? '');
  }, []);

  if (seeds === null) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <p>계획서를 먼저 넣어 주세요.</p>
        <Link to="/new/plan" className="mt-3 inline-block text-accent">← 계획서 넣기로</Link>
      </main>
    );
  }

  function update(index: number, patch: Partial<SegmentSeed>) {
    setSeeds((current) =>
      current === null ? null : current.map((seed, i) => (i === index ? { ...seed, ...patch } : seed)),
    );
  }

  async function handleCreate() {
    if (seeds === null) return;
    const named = seeds.filter((seed) => seed.name.trim() !== '');
    if (title.trim() === '') {
      setError('행사 제목을 입력해 주세요.');
      return;
    }
    if (named.length === 0) {
      setError('순서를 최소 하나는 넣어 주세요.');
      return;
    }
    const event = createEventFromSeeds(named, {
      title: title.trim(),
      date,
      place: place.trim(),
      mode,
      audience,
      tone,
      targetMinutes: null,
    });
    await putEvent(event);
    clearPlanDraft();
    navigate(`/event/${event.id}/edit`);
  }

  const field = 'w-full rounded-xl border border-line px-3 py-2';

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4 pb-16">
      <header className="flex items-center gap-3">
        <Link to="/new/plan" className="text-accent">← 다시 넣기</Link>
        <h1 className="text-lg font-bold">식순 확인</h1>
      </header>

      {seeds.length === 0 && (
        <p className="rounded-xl bg-warn-soft p-3 text-sm">
          계획서에서 식순을 찾지 못했습니다. 아래에서 직접 순서를 추가하시거나,
          <Link to="/new" className="text-accent"> 표준 템플릿으로 시작</Link>하셔도 됩니다.
        </p>
      )}

      <ul className="space-y-2">
        {/* 좁은 폰에서는 종류와 삭제가 아랫줄로 흐른다. 한 줄에 넷을 밀어 넣으면
            순서명 칸이 짓눌려 글자가 몇 자 안 보인다. */}
        {seeds.map((seed, index) => (
          <li key={index} data-testid="outline-row"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
            <span className="w-6 shrink-0 text-sm text-ink-soft">{index + 1}</span>
            <input
              className="min-w-40 flex-1 rounded-xl border border-line px-2 py-1"
              aria-label={`${index + 1}번 순서명`}
              value={seed.name}
              onChange={(e) => update(index, { name: e.target.value })}
            />
            <select
              className="rounded-xl border border-line px-1 py-1 text-sm"
              aria-label={`${index + 1}번 종류`}
              value={seed.kind}
              onChange={(e) => update(index, { kind: e.target.value as SegmentKind })}
            >
              {KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>{kind.label}</option>
              ))}
            </select>
            <button className="text-sm text-danger"
                    onClick={() => setSeeds(seeds.filter((_, i) => i !== index))}>
              삭제
            </button>
          </li>
        ))}
      </ul>

      <button className="rounded-xl border border-line px-3 py-2"
              onClick={() => setSeeds([...seeds, blankSeed()])}>
        ＋ 순서 추가
      </button>

      <hr className="border-line" />

      <div>
        <label className="block text-sm font-medium" htmlFor="title">행사 제목</label>
        <input id="title" className={field} value={title}
               onChange={(e) => setTitle(e.target.value)} />
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="block text-sm font-medium" htmlFor="audience">대상</label>
          <select id="audience" className={field} value={audience}
                  onChange={(e) => setAudience(e.target.value as EventAudience)}>
            <option value="lower">저학년 (1~2학년)</option>
            <option value="upper">고학년</option>
            <option value="all">전교생</option>
            <option value="withParents">학부모·내빈 참석</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-sm font-medium" htmlFor="tone">멘트 톤</label>
          <select id="tone" className={field} value={tone}
                  onChange={(e) => setTone(e.target.value as EventTone)}>
            <option value="formal">정중하게</option>
            <option value="warm">따뜻하게</option>
            <option value="concise">간결하게</option>
          </select>
        </div>
      </div>

      {error !== '' && <p className="text-danger">{error}</p>}

      <button className="w-full rounded-xl bg-accent px-4 py-3 text-white"
              onClick={() => void handleCreate()}>
        이 식순으로 행사 만들기
      </button>
    </main>
  );
}
