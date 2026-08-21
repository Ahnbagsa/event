import { useState } from 'react';
import { buildShareUrl } from '../../share/scenarioLink';
import type { EventCeremony } from '../../types';

export default function ShareButton({ event }: { event: EventCeremony }) {
  const [message, setMessage] = useState('');

  async function handleCopy() {
    try {
      const url = buildShareUrl(event, window.location.origin, window.location.pathname);
      await navigator.clipboard.writeText(url);
      setMessage('링크를 복사했습니다. 휴대폰으로 보내세요.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '링크를 만들지 못했습니다.');
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button className="text-blue-600" onClick={() => void handleCopy()}>
        링크 복사
      </button>
      {message !== '' && <span className="text-sm text-gray-600">{message}</span>}
    </span>
  );
}
