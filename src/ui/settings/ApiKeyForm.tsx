import { useEffect, useState } from 'react';
import { discoverModels, generateText, defaultDeps, GeminiError } from '../../gemini/client';
import { getSettings, saveSettings } from '../../db/settingsRepo';
import type { AppSettings } from '../../types';

type Line = { label: string; state: 'pending' | 'ok' | 'fail'; detail: string };

export default function ApiKeyForm() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Line[] | null>(null);

  useEffect(() => {
    void getSettings().then((loaded) => {
      setSettings(loaded);
      setApiKey(loaded.geminiApiKey);
    });
  }, []);

  function describe(caught: unknown): string {
    if (caught instanceof GeminiError) return caught.info.message;
    return '알 수 없는 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.';
  }

  async function handleSaveAndDiscover() {
    if (settings === null) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const discovered = await discoverModels(apiKey.trim(), defaultDeps());
      const next: AppSettings = {
        ...settings,
        geminiApiKey: apiKey.trim(),
        apiVersion: discovered.apiVersion,
        selectedModel: discovered.models[0].name,
        modelPinnedByUser: false,
        discoveredModels: discovered.models,
        discoveredAt: Date.now(),
      };
      await saveSettings(next);
      setSettings(next);
      setMessage(
        `모델 ${discovered.models.length}개를 찾았습니다. ${discovered.models[0].displayName}을(를) 쓰겠습니다.`,
      );
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePickModel(name: string) {
    if (settings === null) return;
    const next: AppSettings = { ...settings, selectedModel: name, modelPinnedByUser: true };
    await saveSettings(next);
    setSettings(next);
  }

  async function handleTest() {
    if (settings === null) return;
    setBusy(true);
    const lines: Line[] = [
      { label: '모델 목록 조회', state: 'pending', detail: '' },
      { label: '문장 생성 테스트', state: 'pending', detail: '' },
    ];
    setReport([...lines]);

    try {
      const discovered = await discoverModels(settings.geminiApiKey, defaultDeps());
      lines[0] = { label: '모델 목록 조회', state: 'ok', detail: `성공 — ${discovered.models.length}개` };
      setReport([...lines]);

      const started = Date.now();
      const result = await generateText(
        { parts: [{ text: '"안녕하세요"라고만 답해 주세요.' }], temperature: 0 },
        defaultDeps(),
      );
      lines[1] = {
        label: '문장 생성 테스트',
        state: 'ok',
        detail: `성공 — ${result.modelUsed} (${((Date.now() - started) / 1000).toFixed(1)}초)`,
      };
      setReport([...lines]);
    } catch (caught) {
      const failedIndex = lines.findIndex((line) => line.state === 'pending');
      if (failedIndex !== -1) {
        lines[failedIndex] = { ...lines[failedIndex], state: 'fail', detail: describe(caught) };
      }
      setReport([...lines]);
    } finally {
      setBusy(false);
    }
  }

  if (settings === null) return null;

  return (
    <section className="mx-auto max-w-xl space-y-4 p-4">
      <h2 className="text-xl font-bold">AI 연결</h2>
      <p className="text-sm text-gray-600">
        Google AI Studio에서 무료 API 키를 발급받아 넣어 주세요. 키는 이 기기에만 저장됩니다.
        AI 없이도 대본을 직접 작성하고 행사를 진행할 수 있습니다.
      </p>

      <div>
        <label className="block text-sm font-medium" htmlFor="apiKey">Gemini API 키</label>
        <input
          id="apiKey"
          type="password"
          className="w-full rounded border border-gray-400 px-3 py-2"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400"
                disabled={busy || apiKey.trim() === ''}
                onClick={() => void handleSaveAndDiscover()}>
          저장하고 모델 찾기
        </button>
        <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50"
                disabled={busy || settings.geminiApiKey === ''}
                onClick={() => void handleTest()}>
          연결 테스트
        </button>
      </div>

      {message !== '' && <p className="text-green-700">{message}</p>}
      {error !== '' && <p className="text-red-600">{error}</p>}

      {settings.discoveredModels.length > 0 && (
        <div>
          <label className="block text-sm font-medium" htmlFor="model">사용할 모델</label>
          <select
            id="model"
            className="w-full rounded border border-gray-400 px-3 py-2"
            value={settings.selectedModel ?? ''}
            onChange={(e) => void handlePickModel(e.target.value)}
          >
            {settings.discoveredModels.map((model) => (
              <option key={model.name} value={model.name}>
                {model.displayName}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-600">
            보통은 그대로 두시면 됩니다. 앱이 가장 알맞은 모델을 자동으로 고릅니다.
          </p>
        </div>
      )}

      {report !== null && (
        <ul data-testid="test-report" className="space-y-1 rounded border border-gray-300 p-3 text-sm">
          {report.map((line) => (
            <li key={line.label}>
              {line.state === 'ok' ? '✅' : line.state === 'fail' ? '❌' : '⏳'} {line.label}
              {line.detail !== '' && ` — ${line.detail}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
