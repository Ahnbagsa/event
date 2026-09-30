import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fileToInline, ACCEPTED_PLAN_TYPES } from '../../gemini/fileToInline';
import { extractOutline } from '../../gemini/extractOutline';
import { defaultDeps, GeminiError } from '../../gemini/client';
import { getProfile } from '../../db/profileRepo';
import { savePlanDraft } from './planDraft';

export default function ImportPlanPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleExtract() {
    setBusy(true);
    setError('');
    try {
      const inline = await Promise.all(files.map(fileToInline));
      const profile = await getProfile();
      const outline = await extractOutline({ text, files: inline }, profile, defaultDeps());
      savePlanDraft(outline);
      navigate('/new/outline');
    } catch (caught) {
      if (caught instanceof GeminiError) setError(caught.info.message);
      else if (caught instanceof Error) setError(caught.message);
      else setError('식순을 뽑아내지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4 pb-16">
      <header className="flex items-center gap-3">
        <Link to="/new" className="text-accent">← 뒤로</Link>
        <h1 className="text-lg font-bold">계획서에서 식순 뽑기</h1>
      </header>

      <div>
        <label className="block text-sm font-medium" htmlFor="planText">
          계획서 내용 붙여넣기
        </label>
        <textarea
          id="planText"
          rows={10}
          className="w-full rounded-xl border border-line p-2"
          placeholder="한글 문서에서 식순 부분을 드래그해 복사한 뒤 여기에 붙여넣으세요. 표를 그대로 붙여넣어도 됩니다."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="planFiles">
          또는 파일 올리기 (PDF · 사진)
        </label>
        <input
          id="planFiles"
          type="file"
          multiple
          accept={ACCEPTED_PLAN_TYPES.join(',')}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <p className="mt-1 text-sm text-ink-soft">
          한글(hwp) 파일은 읽을 수 없습니다. 한글에서 <strong>PDF로 저장</strong>한 뒤 그 파일을 올려 주세요.
        </p>
        {files.length > 0 && (
          <ul className="mt-1 text-sm">
            {files.map((file) => <li key={file.name}>· {file.name}</li>)}
          </ul>
        )}
      </div>

      {error !== '' && <p className="text-danger">{error}</p>}

      <button
        className="w-full rounded-full bg-accent font-semibold px-4 py-3 text-white disabled:bg-line"
        disabled={busy || (text.trim() === '' && files.length === 0)}
        onClick={() => void handleExtract()}
      >
        {busy ? '식순을 읽는 중입니다…' : '식순 뽑아내기'}
      </button>
    </main>
  );
}
