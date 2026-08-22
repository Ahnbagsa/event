# 행사박사 행사별 음원 구현 계획 (계획서 6)

**Goal:** 같은 역할이라도 행사마다 다른 음원을 쓸 수 있게 한다. 개학식은 애국가 1절, 졸업식은 1~4절. 식순 편집에서 들어보고 고른다.

**Architecture:** 지금은 `putAudio`가 같은 역할의 다른 음원을 지워서 기기에 역할당 하나만 남는다. 이것을 풀어 여러 개를 갖되 역할마다 **기본 음원**을 표시한다. 순서는 기기 안 번호가 아니라 **기기가 바뀌어도 같은 이름표**(`lib:<목록 id>` 또는 `up:<기기 안 번호>`)를 가리키고, 그 이름표를 못 찾으면 역할의 기본 음원으로 되돌아간다. 공유 링크로 휴대폰에 옮겨도 깨지지 않기 위해서다.

**Spec:** `docs/superpowers/specs/2026-08-22-haengsa-baksa-mobile-and-shared-audio-design.md` (B절의 연장)

**전제:** 계획서 5까지 main에 병합·배포되어 있고 테스트 516개가 통과한다.

## Global Constraints

- 계획서 1·4·5의 Global Constraints를 승계한다.
- **IndexedDB 스키마 버전을 올리지 않는다.** 이미 저장된 음원과 행사가 마이그레이션 없이 그대로 열려야 한다. 새 칸은 없으면 없는 대로 읽을 때 판정한다.
- **예전 공유 링크가 계속 열려야 한다.** 링크 형식에 열쇠를 더하되 없을 때를 견딘다.
- 사용자에게 보이는 글은 항상 한국어다.

## File Structure

| 경로 | 책임 |
|---|---|
| `src/audio/audioSource.ts` | 이름표 만들기·읽기, 순서에 맞는 음원 찾기, 안 쓰는 음원 찾기 |
| `src/db/audioRepo.ts` | 역할당 여러 개 보관, 기본 음원 지정 |
| `src/ui/editor/SegmentAudio.tsx` | 식순 편집에서 순서별 음원 듣고 고르기 |
| `src/ui/settings/AudioDrawer.tsx` | 역할당 여러 개 보이기, 기본 표시, 안 쓰는 음원 표시, 지우기 |

---

## Task 1: 이름표와 찾기 규칙

**Files:** Create `src/audio/audioSource.ts` · Test `src/audio/audioSource.test.ts`

- `libSourceId(trackId)` → `lib:<trackId>` · `uploadSourceId(id)` → `up:<id>`
- `defaultAssetForRole(assets, role)` — `isDefault`가 붙은 것, 없으면 가장 최근에 넣은 것
- `assetForSegment(assets, segment)` — 순서의 이름표로 찾고, 못 찾으면 역할의 기본 음원
- `usedSourceIds(events)` — 어떤 행사도 안 가리키는 음원을 서랍에서 알려주기 위한 것

**핵심:** 이름표를 못 찾을 때 반드시 기본 음원으로 되돌아가야 한다. 휴대폰에는 그 음원이 없을 수 있다.

## Task 2: 역할당 여러 개 보관

**Files:** Modify `src/db/audioRepo.ts`, `src/types.ts` · Test `src/db/audioRepo.test.ts`

`putAudio`가 같은 역할의 다른 음원을 **지우지 않는다.** 대신 넣은 것을 그 역할의 기본으로 표시하고 다른 것의 표시만 뗀다. 설정에서 고른 것이 기본이 되는 지금 느낌은 그대로 남는다.

`AudioAsset`에 `sourceId?`와 `isDefault?`를 더한다. 둘 다 예전 자료에는 없으므로 **읽을 때 판정한다.**

## Task 3: 순서가 음원을 가리킨다

**Files:** Modify `src/types.ts`, `src/domain/templates/*`, `src/domain/segmentOps.ts`, `src/share/scenarioLink.ts` · Test

`Segment.audioSourceId: string | null`. 링크 형식에 짧은 열쇠 하나를 더하되, 없는 예전 링크도 그대로 열린다.

## Task 4: 점검과 진행을 순서 단위로

**Files:** Modify `src/domain/preflight.ts`, `src/ui/preflight/PreflightPage.tsx`, `src/ui/run/RunPage.tsx` · Test

지금은 **역할** 단위로 음원 유무를 본다. 순서마다 다른 음원을 쓰면 **순서** 단위로 봐야 한다.

## Task 5: 식순 편집에서 고르기

**Files:** Create `src/ui/editor/SegmentAudio.tsx` · Modify `src/ui/editor/SegmentCard.tsx` · Test

지금 쓸 음원과 **들어보기**, **다른 음원으로**. 아직 안 받은 공용 음원은 주소로 바로 들어보고, 고를 때만 내려받는다.

## Task 6: 서랍에서 여러 개 다루기

**Files:** Modify `src/ui/settings/AudioDrawer.tsx` · Test

역할당 받은 것을 모두 보이고, 기본을 표시하고, 어떤 행사도 안 쓰는 것은 **안 쓰는 음원**으로 알려 지우기 쉽게 한다. 지우는 것은 사용자가 정한다.
