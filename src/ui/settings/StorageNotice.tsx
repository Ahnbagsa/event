import { useCallback, useEffect, useState } from 'react';
import { isStoragePersisted, requestPersistentStorage } from '../../db/persist';

export default function StorageNotice() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [supported, setSupported] = useState(false);
  const [asked, setAsked] = useState(false);

  const refresh = useCallback(async () => {
    setSupported(
      (navigator as Navigator & { storage?: { persist?: unknown } }).storage?.persist !==
        undefined,
    );
    setPersisted(await isStoragePersisted());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (persisted === null) return null;

  async function handleRequest() {
    setAsked(true);
    await requestPersistentStorage();
    await refresh();
  }

  return (
    <section data-testid="storage-notice" className="mx-4 mb-4 rounded border border-gray-300 p-3 text-sm">
      {persisted ? (
        <p>✅ 등록한 음원과 행사를 이 기기에 안전하게 보관하고 있습니다.</p>
      ) : (
        <div className="space-y-2">
          <p>
            ⚠️ 이 기기의 저장 공간이 부족해지면 브라우저가 등록한 음원을 지울 수 있습니다.
          </p>
          {supported && (
            <>
              <button
                className="rounded border border-gray-400 px-3 py-1"
                onClick={() => void handleRequest()}
              >
                보호 요청하기
              </button>
              {asked && (
                <p className="text-gray-600">
                  브라우저가 아직 허락하지 않았습니다. 이 페이지를 즐겨찾기에 넣거나 홈 화면에
                  앱으로 설치하면 대부분 허락됩니다.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
