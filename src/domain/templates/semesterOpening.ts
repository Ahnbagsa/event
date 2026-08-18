import type { Segment } from '../../types';

export type SegmentSeed = Omit<Segment, 'id' | 'order'>;

function seed(partial: Partial<SegmentSeed> & { name: string; kind: Segment['kind'] }): SegmentSeed {
  return {
    groupLabel: null,
    script: '',
    audioRole: null,
    autoPlay: false,
    fadeOutSec: null,
    timerSec: null,
    manualDurationSec: null,
    note: '',
    ...partial,
  };
}

export const semesterOpeningSeeds: SegmentSeed[] = [
  seed({ name: '개식사', kind: 'speech' }),
  seed({
    name: '국기에 대한 경례',
    kind: 'audio',
    groupLabel: '국민의례',
    audioRole: 'pledge',
    note: '맹세문 낭독. 약식으로 진행할 때는 이 순서만 남깁니다.',
  }),
  seed({
    name: '애국가 제창',
    kind: 'audio',
    groupLabel: '국민의례',
    audioRole: 'anthem',
    note: '보통 1절만 제창합니다.',
  }),
  seed({
    name: '순국선열 및 호국영령에 대한 묵념',
    kind: 'timer',
    groupLabel: '국민의례',
    audioRole: 'silence',
    timerSec: 60,
  }),
  seed({ name: '학교장 말씀', kind: 'address', manualDurationSec: 180 }),
  seed({ name: '교가 제창', kind: 'audio', audioRole: 'schoolSong' }),
  seed({ name: '폐식사', kind: 'speech' }),
];

// 기본 식순에는 없지만 학교 사정에 따라 넣는 순서들.
// 편집기의 "순서 추가"에서 고를 수 있다.
export const standardExtraSeeds: SegmentSeed[] = [
  seed({ name: '전달 사항', kind: 'address', manualDurationSec: 120, note: '교무·생활·보건' }),
  seed({ name: '내빈 소개', kind: 'speech' }),
  seed({ name: '축사', kind: 'address', manualDurationSec: 180 }),
  seed({ name: '시상', kind: 'audio', audioRole: 'award' }),
  seed({ name: '학생 대표 인사', kind: 'address', manualDurationSec: 120 }),
  seed({ name: '입장', kind: 'audio', audioRole: 'entrance' }),
  seed({ name: '퇴장', kind: 'audio', audioRole: 'exit', fadeOutSec: 3 }),
  seed({ name: '새로 만들기', kind: 'speech' }),
];
