# 행사박사 모바일·공용 음원·동영상 구현 계획 (계획서 5)

**Goal:** 휴대폰에서 글씨와 테두리가 겹치는 문제를 화면마다가 아니라 뿌리에서 고치고, 처음 앱을 여는 다른 선생님이 백지에서 겪는 문턱을 낮추며, 강당 빔프로젝터에 쓸 동영상 재생을 더한다.

**Architecture:** 글자 크기는 `src/index.css`의 `@theme`에 `clamp()`로 정의해 화면 코드를 고치지 않고 전 화면이 함께 반응하게 한다. 겹침은 전역 `min-width: 0`으로 원인을 없앤다. 공용 음원은 `public/audio/library.json` 한 파일이 목록을 정의하고, 고르면 기존 `putAudio`로 기기에 내려받아 저장한다. 동영상은 `AudioController`가 이미 `MediaLike` 인터페이스에만 의존하므로 재생 로직을 고치지 않고 `<video>`를 끼운다.

**Tech Stack:** Tailwind CSS v4 (`@theme`) · React 19 · 기존 IndexedDB 스키마 그대로

**Spec:** `docs/superpowers/specs/2026-08-22-haengsa-baksa-mobile-and-shared-audio-design.md`

**전제:** 계획서 1~4가 `main`에 병합되어 있고, 시작 시점 기준 테스트 344개가 통과한다.

## Global Constraints

- 계획서 1·4의 Global Constraints를 그대로 승계한다.
- **색을 화면에서 직접 쓰지 않는다.** `src/index.css`의 토큰 이름만 쓴다.
- 사용자에게 보이는 글은 항상 한국어다.
- **기존 테스트 344개가 계속 통과해야 한다.** 깨지면 그 테스트가 겉모습에 기대고 있었다는 뜻이므로 함께 고치고 커밋 메시지에 남긴다.
- 버튼·제목의 글자를 함부로 바꾸지 않는다. 테스트가 글자로 요소를 찾는다.
- **IndexedDB 스키마 버전을 올리지 않는다.** 이미 저장된 음원이 마이그레이션 없이 그대로 열려야 한다.
- `library.json`이 없거나 비었거나 인터넷이 끊겨도 **앱은 지금과 똑같이 동작해야 한다.** 오류를 띄우지 않는다.

## File Structure

| 경로 | 책임 |
|---|---|
| `src/index.css` | 색·글자 크기·줄간격 토큰, 입력칸 전역 안전장치, safe-area |
| `src/ui/kit/IconButton.tsx` | 최소 44×44px 터치 영역을 보장하는 작은 버튼 |
| `src/media/mediaKind.ts` | mimeType으로 음원·영상 판정 |
| `src/media/library.ts` | `library.json` 해석과 불러오기 |
| `src/media/fetchLibraryTrack.ts` | 공용 음원을 내려받아 `AudioAsset`으로 |
| `src/ui/settings/LibraryPicker.tsx` | 역할별 공용 음원 고르기·미리듣기 |
| `src/ui/onboarding/Onboarding.tsx` | 첫 실행 세 걸음 안내 |
| `public/audio/library.json` | 공용 음원 목록 (사용자가 채운다) |

---

## A. 모바일 반응형

### Task A1: 글자 크기·줄간격 토큰과 전역 안전장치

**Files:** Modify `src/index.css` · Test `src/ui/kit/kit.test.tsx`

`@theme`에 `--text-xs`부터 `--text-5xl`까지 **전부** `clamp()`로 정의하고 짝이 되는 `--text-*--line-height`를 준다. 하나라도 빠뜨리면 그 크기만 Tailwind 기본값으로 남는다. 본문 계열 1.65, 제목 계열 1.35.

전역 규칙 세 가지를 더한다.

- `input, select, textarea { min-width: 0; max-width: 100%; }` — 날짜칸이 옆 칸을 밀고 들어오는 원인을 없앤다
- `body { padding-bottom: env(safe-area-inset-bottom); }` 계열 — 아이폰 홈 인디케이터
- `h1..h6, p { overflow-wrap: anywhere; }` — 긴 학교명이 상자를 뚫지 않게

### Task A2: 날짜·장소 겹침

**Files:** Modify `src/ui/NewEventPage.tsx`, `src/ui/wizard/OutlineReviewPage.tsx`

같은 결함이 두 곳에 복사되어 있다. `flex gap-2` + `flex-1` 쌍을 `grid grid-cols-1 sm:grid-cols-2 gap-3`으로 바꾼다. 좁은 폰에서는 위아래로 쌓이고 넓어지면 두 칸이 된다. `OutlineReviewPage`의 대상·톤 쌍도 같다.

### Task A3: 식순 카드 두 줄 구조와 터치 영역

**Files:** Create `src/ui/kit/IconButton.tsx` · Modify `src/ui/editor/SegmentCard.tsx` · Test `src/ui/kit/kit.test.tsx`

한 줄에 있던 일곱 개를 제목 줄과 조작 줄로 나눈다. 제목은 전체 폭을 쓴다. 조작 줄은 `flex-wrap`. `▲ ▼ 삭제 펼치기`는 `IconButton`으로 바꿔 최소 44×44px을 확보한다.

### Task A4: 편집기 헤더와 PageHeader

**Files:** Modify `src/ui/editor/EditorPage.tsx`, `src/ui/kit/PageHeader.tsx`

헤더도 같은 처방을 받는다. 제목이 오른쪽 버튼에 밀리지 않게 하고 좁아지면 아래로 흐르게 한다.

### Task A5: 나머지 화면 훑기

**Files:** Modify `src/ui/Home.tsx`, `src/ui/preflight/PreflightPage.tsx`, `src/ui/run/RunPage.tsx`, `src/ui/wizard/OutlineReviewPage.tsx`

한 줄에 너무 많이 넣은 곳을 찾아 `flex-wrap`과 `min-w-0`을 준다.

---

## B. 공용 음원 라이브러리

### Task B1: library.json 해석

**Files:** Create `src/media/library.ts` · Test `src/media/library.test.ts`

`LibraryTrack { id, role, label, file, note?, credit?, durationSec? }`. 해석은 **관대해야 한다** — 모르는 필드는 무시하고, 망가진 줄은 건너뛰고, 파일이 없거나 JSON이 깨졌으면 빈 목록을 돌려준다(던지지 않는다). 앱이 음원 없이도 살아야 하기 때문이다.

### Task B2: 공용 음원 내려받기

**Files:** Create `src/media/fetchLibraryTrack.ts` · Test `src/media/fetchLibraryTrack.test.ts`

`fetch` → `arrayBuffer` → 길이를 파일에서 다시 재서 `AudioAsset`을 만든다. `library.json`의 `durationSec`은 목록 표시용이고 믿지 않는다.

### Task B3: 음원 서랍에 고르기 칸

**Files:** Create `src/ui/settings/LibraryPicker.tsx` · Modify `src/ui/settings/AudioDrawer.tsx` · Test `src/ui/settings/LibraryPicker.test.tsx`

역할별 후보를 보이고 ▶로 미리듣기, 고르면 내려받아 저장. **미리듣기는 내려받지 않고 주소를 그대로 재생한다.** 후보가 없으면 칸 자체를 접는다.

### Task B4: 목록 파일과 안내

**Files:** Create `public/audio/library.json`, `public/audio/README.md` · Modify `README.md`

빈 목록으로 시작한다. 음원 추가 방법을 적는다.

---

## D. 동영상

### Task D1: 영상 종류 판정

**Files:** Create `src/media/mediaKind.ts` · Modify `src/audio/mimeFromName.ts` · Test

`mp4 · webm · mov · m4v`와 `video/*`를 인정한다. `mp4`는 지금 `audio/mp4`로 판정되는데, 영상 mp4와 소리만 있는 m4a를 확장자만으로는 못 가른다. **파일이 보고한 종류를 먼저 믿고, 없으면 확장자로 본다.**

`mediaKindOf(mimeType)`는 `'video'` 또는 `'audio'`를 돌려준다. `AudioAsset`에 `kind`를 저장하지 않고 **읽을 때 판정한다** — 기존 데이터가 마이그레이션 없이 열려야 하기 때문이다.

### Task D2: 영상 길이 측정

**Files:** Modify `src/audio/readAudioDuration.ts` · Test

`new Audio()`는 영상을 못 읽는다. 종류에 따라 `<video>`를 만든다.

### Task D3: 영상 재생

**Files:** Modify `src/audio/usePlayer.ts` · Test

`new Audio(url)` 고정을 종류에 따라 갈라낸다. `AudioController`는 **고치지 않는다** — `MediaLike`가 이미 `<video>`를 받는다. `usePlayer`가 만든 요소를 화면이 붙일 수 있도록 내보낸다.

### Task D4: 진행 화면 작게 보이다가 크게 보기

**Files:** Modify `src/ui/run/RunPage.tsx` · Test

영상이면 재생 줄에 작게 띄우고 **크게 보기** 버튼을 준다. 누르면 영상 요소를 전체화면으로 보낸다. iOS Safari는 일반 요소의 전체화면을 막지만 `<video>`는 허용한다. 실패하면 조용히 원래대로 둔다.

### Task D5: 서랍에서 영상 올리기

**Files:** Modify `src/ui/settings/AudioDrawer.tsx` · Test

파일 고르기가 영상도 받게 하고, 목록에 종류를 보인다. 큰 파일은 저장 공간을 많이 쓴다는 안내를 붙인다.

---

## C. 온보딩

### Task C1: 첫 실행 세 걸음

**Files:** Create `src/ui/onboarding/Onboarding.tsx` · Modify `src/ui/Home.tsx` · Test

학교 프로필이 없으면 홈에 안내를 띄운다. 학교명 → 공용 음원 → AI 연결. **세 걸음 모두 건너뛸 수 있다.**

### Task C2: 키 없이도 막히지 않게

**Files:** Modify `src/ui/editor/EditorPage.tsx`, `src/ui/settings/ApiKeyForm.tsx` · Test

키가 없으면 AI 버튼 자리에 무엇을 하면 되는지 보인다. 식순 짜기와 행사 진행은 키 없이 전부 된다는 것을 분명히 한다.
