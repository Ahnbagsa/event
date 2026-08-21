import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearDb } from '../../db/testUtils';
import { getSettings } from '../../db/settingsRepo';
import ApiKeyForm from './ApiKeyForm';

const discoverModels = vi.fn();
const generateText = vi.fn();

vi.mock('../../gemini/client', async () => {
  const actual = await vi.importActual<typeof import('../../gemini/client')>('../../gemini/client');
  return {
    ...actual,
    discoverModels: (...args: unknown[]) => discoverModels(...args),
    generateText: (...args: unknown[]) => generateText(...args),
    defaultDeps: () => ({}),
  };
});

const MODELS = [
  { name: 'models/gemini-2.5-flash', displayName: 'Flash', score: 300, inputTokenLimit: 1, outputTokenLimit: 1 },
  { name: 'models/gemini-2.5-pro', displayName: 'Pro', score: 260, inputTokenLimit: 1, outputTokenLimit: 1 },
];

describe('ApiKeyForm', () => {
  beforeEach(async () => {
    await clearDb();
    discoverModels.mockReset();
    generateText.mockReset();
  });

  it('키를 저장하면 모델을 탐색해 자동으로 고른다', async () => {
    const user = userEvent.setup();
    discoverModels.mockResolvedValue({ apiVersion: 'v1beta', models: MODELS });

    render(<ApiKeyForm />);
    await user.type(await screen.findByLabelText('Gemini API 키'), 'AIza-테스트');
    await user.click(screen.getByRole('button', { name: '저장하고 모델 찾기' }));

    await waitFor(async () => {
      const settings = await getSettings();
      expect(settings.geminiApiKey).toBe('AIza-테스트');
      expect(settings.selectedModel).toBe('models/gemini-2.5-flash');
      expect(settings.discoveredModels).toHaveLength(2);
    });

    expect(await screen.findByText(/모델 2개를 찾았습니다/)).toBeInTheDocument();
  });

  it('키가 잘못되면 한국어 오류를 보여준다', async () => {
    const user = userEvent.setup();
    const { GeminiError } = await import('../../gemini/client');
    discoverModels.mockRejectedValue(
      new GeminiError({ kind: 'key', retryAfterSec: null, message: 'API 키가 올바르지 않습니다.' }),
    );

    render(<ApiKeyForm />);
    await user.type(await screen.findByLabelText('Gemini API 키'), '나쁜키');
    await user.click(screen.getByRole('button', { name: '저장하고 모델 찾기' }));

    expect(await screen.findByText('API 키가 올바르지 않습니다.')).toBeInTheDocument();
  });

  it('연결 테스트가 각 단계 결과를 보여준다', async () => {
    const user = userEvent.setup();
    discoverModels.mockResolvedValue({ apiVersion: 'v1beta', models: MODELS });
    generateText.mockResolvedValue({
      text: '안녕하세요',
      modelUsed: 'models/gemini-2.5-flash',
      modelChanged: false,
    });

    render(<ApiKeyForm />);
    await user.type(await screen.findByLabelText('Gemini API 키'), 'AIza-테스트');
    await user.click(screen.getByRole('button', { name: '저장하고 모델 찾기' }));
    await screen.findByText(/모델 2개를 찾았습니다/);

    await user.click(screen.getByRole('button', { name: '연결 테스트' }));

    const report = await screen.findByTestId('test-report');
    await waitFor(() => {
      expect(report).toHaveTextContent('모델 목록 조회');
      expect(report).toHaveTextContent('문장 생성 테스트');
      expect(report).toHaveTextContent('성공');
    });
  });

  it('모델을 직접 고르면 그 선택을 기억한다', async () => {
    const user = userEvent.setup();
    discoverModels.mockResolvedValue({ apiVersion: 'v1beta', models: MODELS });

    render(<ApiKeyForm />);
    await user.type(await screen.findByLabelText('Gemini API 키'), 'AIza-테스트');
    await user.click(screen.getByRole('button', { name: '저장하고 모델 찾기' }));
    await screen.findByText(/모델 2개를 찾았습니다/);

    await user.selectOptions(screen.getByLabelText('사용할 모델'), 'models/gemini-2.5-pro');

    await waitFor(async () => {
      const settings = await getSettings();
      expect(settings.selectedModel).toBe('models/gemini-2.5-pro');
      expect(settings.modelPinnedByUser).toBe(true);
    });
  });

  it('키를 화면에 그대로 노출하지 않는다', async () => {
    render(<ApiKeyForm />);
    expect(await screen.findByLabelText('Gemini API 키')).toHaveAttribute('type', 'password');
  });
});
