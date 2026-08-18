import { DB_NAME, openHbDb, resetDbHandleForTests } from './schema';

export async function clearDb(): Promise<void> {
  const db = await openHbDb().catch(() => null);
  db?.close();
  resetDbHandleForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
