import { useState } from 'react';
import Button from '../kit/Button';
import QrCode from './QrCode';
import { buildShareUrl } from '../../share/scenarioLink';
import type { EventCeremony } from '../../types';

export default function ShareButton({ event }: { event: EventCeremony }) {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleCopy() {
    setError('');
    let built: string;
    try {
      built = buildShareUrl(event, window.location.origin, window.location.pathname);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '링크를 만들지 못했습니다.');
      return;
    }

    setUrl(built);
    try {
      await navigator.clipboard.writeText(built);
      setMessage('링크를 복사했습니다. 휴대폰으로 보내세요.');
    } catch {
      setMessage('');
      setError('링크를 복사하지 못했습니다. 아래 QR을 휴대폰으로 찍어 주세요.');
    }
  }

  function handleClose() {
    setUrl('');
    setMessage('');
    setError('');
  }

  return (
    <>
      <Button variant="ghost" onClick={() => void handleCopy()}>링크 복사</Button>

      {/* QR은 280px 고정 크기다. 이 버튼은 홈 카드와 편집기 상단 바의 가로 줄 안에
          들어가 있어서, 패널을 그 줄 안에 그리면 휴대폰 너비에서 줄이 넘쳐 화면 밖으로
          삐져나간다. 편집기에서는 상단 바가 sticky라 화면을 통째로 가린다.
          그래서 패널은 흐름 밖(fixed)에 띄운다. */}
      {url !== '' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4">
          <div
            data-testid="share-panel"
            className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border border-white bg-paper-raised p-4 shadow-lift text-center text-sm"
          >
            {message !== '' && <p className="mb-2 text-ok">{message}</p>}
            {error !== '' && <p className="mb-2 text-danger">{error}</p>}

            <div className="flex justify-center">
              <QrCode value={url} />
            </div>
            <p className="mt-2 text-ink-soft">휴대폰 카메라로 찍으세요</p>

            <Button className="mt-3" onClick={handleClose}>닫기</Button>
          </div>
        </div>
      )}

      {url === '' && error !== '' && <span className="text-sm text-danger">{error}</span>}
    </>
  );
}
