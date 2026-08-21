export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export default function InstallHint() {
  if (isStandalone()) return null;
  if (!isIos() && !isAndroid()) return null;

  return (
    <div className="mb-4 rounded bg-amber-100 p-3 text-sm">
      <p className="font-medium">📱 휴대폰으로 행사를 진행하시려면 먼저 설치해 주세요</p>
      {isIos() ? (
        <p className="mt-1">
          아래쪽 <strong>공유</strong> 버튼 → <strong>홈 화면에 추가</strong>를 눌러 주세요.
          설치하지 않으면 며칠 뒤 사파리가 등록해 둔 음원을 지울 수 있습니다.
        </p>
      ) : (
        <p className="mt-1">
          브라우저 메뉴(⋮) → <strong>홈 화면에 추가</strong>를 눌러 주세요.
          설치하면 인터넷 없이도 실행됩니다.
        </p>
      )}
    </div>
  );
}
