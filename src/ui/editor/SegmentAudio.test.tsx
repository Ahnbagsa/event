import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SegmentAudio from './SegmentAudio';
import { clearDb } from '../../db/testUtils';
import { listAudio, putAudio } from '../../db/audioRepo';
import { parseLibrary } from '../../media/library';
import type { AudioAsset, Segment } from '../../types';

const library = parseLibrary({
  tracks: [
    { id: 'v1', role: 'anthem', label: '1절', file: 'v1.mp3', durationSec: 69 },
    { id: 'v1-4', role: 'anthem', label: '1~4절', file: 'v1-4.mp3', durationSec: 239 },
    { id: 'p1', role: 'pledge', label: '맹세문 없음', file: 'p1.mp3', durationSec: 45 },
  ],
});

function asset(over: Partial<AudioAsset> & { id: string }): AudioAsset {
  return {
    role: 'anthem',
    label: over.id,
    data: new ArrayBuffer(8),
    mimeType: 'audio/mpeg',
    durationSec: 69,
    fileName: over.id + '.mp3',
    addedAt: 1,
    ...over,
  };
}

function segment(over: Partial<Segment> = {}): Segment {
  return {
    id: 'seg1', order: 0, name: '애국가 제창', groupLabel: null, kind: 'audio',
    script: '', audioRole: 'anthem', audioSourceId: null, autoPlay: false,
    fadeOutSec: null, timerSec: null, manualDurationSec: null, note: '', ...over,
  };
}

function show(over: { segment?: Segment; assets?: AudioAsset[] } = {}) {
  const onChange = vi.fn();
  const onAssetsChanged = vi.fn();
  render(
    <SegmentAudio
      segment={over.segment ?? segment()}
      assets={over.assets ?? [asset({ id: 'a1', label: '1절', sourceId: 'lib:v1', isDefault: true })]}
      library={library}
      onChange={onChange}
      onAssetsChanged={onAssetsChanged}
    />,
  );
  return { onChange, onAssetsChanged };
}

describe('SegmentAudio', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('음원이 붙지 않은 순서에는 아무것도 그리지 않는다', () => {
    const { container } = render(
      <SegmentAudio segment={segment({ audioRole: null })} assets={[]} library={library}
                    onChange={vi.fn()} onAssetsChanged={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('지금 쓸 음원과 길이를 보여 준다', () => {
    show();
    const box = screen.getByTestId('segment-audio-seg1');
    expect(box).toHaveTextContent('1절');
    expect(box).toHaveTextContent('1분 9초');
  });

  it('고른 것이 없으면 기본 음원이라고 알려 준다', () => {
    show();
    expect(screen.getByTestId('segment-audio-seg1')).toHaveTextContent('기본 음원');
  });

  it('이 기기에 음원이 하나도 없으면 그렇다고 알려 준다', () => {
    show({ assets: [] });
    expect(screen.getByTestId('segment-audio-seg1')).toHaveTextContent('이 기기에 음원이 없습니다');
  });

  describe('다른 음원으로', () => {
    it('그 역할의 후보만 보여 준다', async () => {
      show();
      await userEvent.click(screen.getByRole('button', { name: '다른 음원으로' }));
      expect(screen.getByTestId('choice-lib:v1-4')).toBeInTheDocument();
      // 맹세문은 역할이 다르므로 나오면 안 된다.
      expect(screen.queryByTestId('choice-lib:p1')).not.toBeInTheDocument();
    });

    it('아직 안 받은 것은 받아 둔다고 알려 준다', async () => {
      show();
      await userEvent.click(screen.getByRole('button', { name: '다른 음원으로' }));
      expect(screen.getByTestId('choice-lib:v1-4')).toHaveTextContent('이 기기에 받아 둡니다');
    });

    it('이미 있는 음원을 고르면 받지 않고 바로 정한다', async () => {
      const assets = [
        asset({ id: 'a1', label: '1절', sourceId: 'lib:v1', isDefault: true }),
        asset({ id: 'a2', label: '1~4절', sourceId: 'lib:v1-4', durationSec: 239 }),
      ];
      const { onChange } = show({ assets });
      await userEvent.click(screen.getByRole('button', { name: '다른 음원으로' }));
      const row = screen.getByTestId('choice-lib:v1-4');
      await userEvent.click(within(row).getByRole('button', { name: '이 순서에 쓰기' }));
      expect(onChange).toHaveBeenCalledWith({ audioSourceId: 'lib:v1-4' });
    });

    it('지금 쓰는 것에 표시가 붙는다', async () => {
      show();
      await userEvent.click(screen.getByRole('button', { name: '다른 음원으로' }));
      expect(screen.getByTestId('choice-lib:v1')).toHaveTextContent('✓');
    });

    // 고르지 않을 파일까지 기기에 쌓을 이유가 없다.
    it('안 받은 음원은 주소로 들어본다', async () => {
      show();
      await userEvent.click(screen.getByRole('button', { name: '다른 음원으로' }));
      await userEvent.click(screen.getByRole('button', { name: '1~4절 들어보기' }));
      expect(screen.getByTestId('segment-preview-lib:v1-4')).toHaveAttribute('preload', 'none');
    });
  });

  describe('기본 음원 쓰기', () => {
    it('고른 것이 없으면 그 버튼이 없다', () => {
      show();
      expect(screen.queryByRole('button', { name: '기본 음원 쓰기' })).not.toBeInTheDocument();
    });

    it('고른 것을 되돌린다', async () => {
      const { onChange } = show({ segment: segment({ audioSourceId: 'lib:v1-4' }) });
      await userEvent.click(screen.getByRole('button', { name: '기본 음원 쓰기' }));
      expect(onChange).toHaveBeenCalledWith({ audioSourceId: null });
    });
  });

  // 공유 링크로 옮겨 온 행사는 이 기기에 없는 음원을 가리킬 수 있다.
  // 조용히 다른 것이 나가면 행사 당일에야 알아차린다.
  it('고른 음원이 이 기기에 없으면 경고하고 무엇이 나갈지 알려 준다', () => {
    show({ segment: segment({ audioSourceId: 'lib:이기기에없음' }) });
    const box = screen.getByTestId('segment-audio-seg1');
    expect(box).toHaveTextContent('기본 음원으로 재생됩니다');
    expect(box).toHaveTextContent('1절');
  });
});

// 한 행사에서만 다른 판본을 쓰려고 받은 음원이 온 기기의 기본을 바꿔서는 안 된다.
describe('받아도 기본 음원은 그대로', () => {
  beforeEach(async () => {
    await clearDb();
  });

  it('putAudio는 기본을 옮기지만 addAudio는 옮기지 않는다', async () => {
    const { addAudio } = await import('../../db/audioRepo');
    await putAudio(asset({ id: 'a1', sourceId: 'lib:v1' }));
    await addAudio(asset({ id: 'a2', sourceId: 'lib:v1-4' }));

    const all = await listAudio();
    expect(all).toHaveLength(2);
    expect(all.filter((a) => a.isDefault === true).map((a) => a.id)).toEqual(['a1']);
  });
});

// 이 기능이 생기기 전에 목록에서 받아 둔 음원에는 이름표가 없다.
// 이름표로만 견주면 같은 음원이 '기기에 있음'과 '받아야 함'으로 두 번 나온다.
describe('이름표 없이 받아 둔 예전 음원', () => {
  it('목록의 같은 음원을 다시 권하지 않는다', async () => {
    const legacy = asset({ id: 'old', label: '1절', fileName: 'v1.mp3' });
    delete (legacy as { sourceId?: unknown }).sourceId;

    render(
      <SegmentAudio segment={segment()} assets={[legacy]} library={library}
                    onChange={vi.fn()} onAssetsChanged={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: '다른 음원으로' }));

    expect(screen.queryByTestId('choice-lib:v1')).not.toBeInTheDocument();
    expect(screen.getByTestId('choice-up:old')).toHaveTextContent('1절');
    // 다른 판본은 여전히 권한다.
    expect(screen.getByTestId('choice-lib:v1-4')).toBeInTheDocument();
  });
});
