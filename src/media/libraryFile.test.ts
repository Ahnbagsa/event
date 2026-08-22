import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLibrary } from './library';

// 진짜 public/audio/library.json을 검사한다.
//
// parseLibrary는 일부러 관대해서, 줄이 잘못되어 있으면 오류 대신 그 음원만
// 조용히 사라진다. 사람이 손으로 고치는 파일이라 그 편이 맞지만, 저장소에
// 들어 있는 목록만큼은 한 줄도 빠짐없이 살아 있어야 한다. 그것을 여기서 못 박는다.

const AUDIO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'audio');
const raw = JSON.parse(readFileSync(join(AUDIO_DIR, 'library.json'), 'utf8'));
const parsed = parseLibrary(raw);
const mp3Files = readdirSync(AUDIO_DIR).filter((name) => name.endsWith('.mp3'));

describe('public/audio/library.json', () => {
  it('적어 둔 줄이 하나도 버려지지 않는다', () => {
    // 개수가 어긋나면 어떤 줄이 잘못되었는지 이름으로 보여 준다.
    const kept = new Set(parsed.map((track) => track.id));
    const dropped = (raw.tracks as { id?: string }[])
      .map((row) => row?.id ?? '(id 없음)')
      .filter((id) => !kept.has(id));
    expect(dropped).toEqual([]);
  });

  it('id가 겹치지 않는다', () => {
    const ids = parsed.map((track) => track.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it.each(parsed.map((track) => [track.id, track.file] as const))(
    '%s 이 가리키는 파일이 실제로 있다',
    (_id, file) => {
      expect(existsSync(join(AUDIO_DIR, file))).toBe(true);
    },
  );

  // 반대 방향도 본다. 올려만 두고 목록에 안 적으면 아무도 그 음원을 못 고른다.
  it('올려 둔 mp3가 모두 목록에 적혀 있다', () => {
    const listed = new Set(parsed.map((track) => track.file));
    expect(mp3Files.filter((name) => !listed.has(name))).toEqual([]);
  });

  it('길이가 그럴듯하다', () => {
    for (const track of parsed) {
      // 의식행사 음원이 1초일 리도, 20분일 리도 없다.
      expect(track.durationSec).toBeGreaterThan(5);
      expect(track.durationSec).toBeLessThan(1200);
    }
  });

  it('교가는 학교마다 다르므로 공용 목록에 없다', () => {
    expect(parsed.filter((track) => track.role === 'schoolSong')).toEqual([]);
  });
});
