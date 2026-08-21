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
    <span className="inline-flex flex-col items-start gap-2">
      <Button variant="ghost" onClick={() => void handleCopy()}>링크 복사</Button>

      {url !== '' && (
        <div data-testid="share-panel"
             className="rounded-2xl border border-line bg-paper-raised p-4 text-sm">
          {message !== '' && <p className="mb-2 text-ok">{message}</p>}
          {error !== '' && <p className="mb-2 text-danger">{error}</p>}

          <QrCode value={url} />
          <p className="mt-2 text-ink-soft">휴대폰 카메라로 찍으세요</p>

          <Button className="mt-2" onClick={handleClose}>닫기</Button>
        </div>
      )}

      {url === '' && error !== '' && <span className="text-sm text-danger">{error}</span>}
    </span>
  );
}
