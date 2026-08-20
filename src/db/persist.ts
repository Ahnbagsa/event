// 브라우저의 기본 저장은 "지워도 되는" 등급이다. 디스크가 부족해지면 크롬이
// IndexedDB를 정리해갈 수 있고, 그러면 행사 전날 등록해 둔 음원이 사라진다.
// persist()로 "지우지 말라"고 표시해 둔다. 크롬은 물어보지 않고 스스로 판단하며
// (북마크·앱 설치·방문 빈도 등), 거절해도 앱은 그대로 동작한다.

type StorageManagerLike = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
};

function storageManager(): StorageManagerLike | undefined {
  return (navigator as Navigator & { storage?: StorageManagerLike }).storage;
}

export async function isStoragePersisted(): Promise<boolean> {
  const storage = storageManager();
  if (storage?.persisted === undefined) return false;
  try {
    return await storage.persisted();
  } catch {
    return false;
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  const storage = storageManager();
  if (storage?.persist === undefined) return false;
  if (await isStoragePersisted()) return true;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}
