# 음악의 마블 웹앱 바이브코딩 프롬프트

> 목적: 보드게임을 하면서 자연스럽게 음악이론의 반복·이동 기호를 익히는 **부르마블 형식 웹앱**을 만든다.  
> 사용 방식: 아래 프롬프트를 Cursor, Claude Code, ChatGPT Codex, Replit Agent, Lovable, v0 등에 단계별로 붙여 넣어 개발한다.

---

## 0. 개발 에이전트에게 줄 마스터 프롬프트

```text
너는 어린이/청소년 음악교육용 웹게임을 만드는 시니어 프론트엔드 개발자이자 UI/UX 디자이너다.

프로젝트명은 “음악의 마블”이다. 부르마블처럼 보드판 위를 이동하면서 음악이론 기호를 배우는 웹앱을 만들어라.

핵심 요구사항:
1. 보드는 사각형 테두리형 보드게임 판이다.
2. 플레이어 말은 보드의 칸을 따라 한 방향으로만 전진한다.
3. 키보드 우측 방향키 ArrowRight를 누르면 앞으로 정확히 한 칸만 이동한다.
4. 주사위 굴리기 버튼이 있어야 한다.
5. 주사위를 굴리면 1~6 중 하나가 나오고, 나온 숫자만큼 이동해야 한다.
6. 이동은 자동 순간이동이 아니라 “한 칸씩” 애니메이션으로 보이게 한다.
7. 기본 조작은 다음과 같이 한다.
   - 주사위 굴리기 클릭
   - 주사위 결과가 나오면 남은 이동 칸 수가 표시됨
   - ArrowRight 또는 화면의 “한 칸 이동” 버튼을 누를 때마다 1칸 이동
   - 남은 이동 칸 수가 0이 되면 현재 칸의 음악기호 이벤트를 실행
8. 보드말이 이동할 때 귀여운 CG/SVG 느낌의 통통 튀는 애니메이션을 적용한다.
9. 보드말이 음악기호 칸에 도착하면 해당 음악기호의 의미와 연결된 화려한 CSS 애니메이션 인터랙션이 발생해야 한다.
10. 각 음악기호 이벤트가 발생하면 학습 카드 또는 토스트로 “이 기호가 실제 악보에서 뜻하는 것”과 “게임에서 발생한 효과”를 설명한다.
11. 모바일에서도 사용할 수 있도록 터치용 “한 칸 이동” 버튼을 제공한다.
12. 모든 게임 규칙은 하드코딩된 if문 난립이 아니라 boardCells 데이터와 rule engine으로 관리한다.
13. MVP는 프론트엔드만으로 동작하는 React + TypeScript + Vite 웹앱으로 만든다.
14. CSS 애니메이션은 가능하면 순수 CSS keyframes로 작성하고, 외부 UI 라이브러리에 의존하지 않는다.
15. 사용자가 제공한 음악기호 이미지가 없거나 로딩 실패하면 텍스트/유니코드 fallback으로 표시한다.
16. 접근성을 고려해 버튼 aria-label, 키보드 조작, reduced motion 대응을 넣는다.

기술 스택:
- React
- TypeScript
- Vite
- CSS Modules 또는 일반 CSS
- Vitest: 규칙 엔진 테스트용
- 로컬 상태 관리: React useReducer 또는 Zustand 없이 useReducer 우선

완성해야 하는 주요 화면:
- 상단: 게임 제목, 현재 턴/상태, 주사위 결과, 남은 이동 수, 페르마타 쉬는 횟수
- 중앙: 40칸 사각형 보드판, 가운데 로고/설명 영역
- 보드 위: 플레이어 말 1개
- 우측 또는 하단: 주사위 버튼, 한 칸 이동 버튼, 리셋 버튼, 이벤트 로그
- 이벤트 발생 시: 음악기호 설명 카드, 보드 전체 이펙트, 해당 칸 highlight

반드시 구현할 음악기호 규칙:
- 다중쉼표: 숫자 4가 적힌 다중쉼표는 4칸 앞으로 이동한다.
- 도돌이표: Post/End 도돌이표 칸에 도착하면 Pre/Start 도돌이표가 있는 칸으로 이동한다.
- 달세뇨 D.S.: 세뇨가 있는 칸으로 이동한다.
- 세뇨: 이동 목표 지점이다. 세뇨 칸 자체는 도착해도 특별 이동을 하지 않는다.
- 코다: 첫 번째 코다 칸에 도착하면 두 번째 코다가 있는 칸으로 이동한다.
- 다카포 D.C.: 보드의 첫 번째 칸, 즉 Start 칸으로 이동한다.
- 제 1괄호: 제 2괄호가 있는 칸으로 이동한다.
- 제 2괄호: 이동 목표 지점이다. 도착해도 특별 이동을 하지 않는다.
- 페르마타: 2번 쉬기. 다음 2번의 주사위 굴리기 턴을 스킵한다.
- 더블세뇨: 첫 번째 더블세뇨 칸에 도착하면 두 번째 더블세뇨가 있는 칸으로 이동한다.
- 더블코다: 첫 번째 더블코다 칸에 도착하면 두 번째 더블코다가 있는 칸으로 이동한다.

중요한 구현 규칙:
- 음악기호 이벤트 이동은 “순간 좌표 변경”이 아니라 0.6~1.2초짜리 특수 이동 애니메이션으로 보여준다.
- 이벤트 이동 후 도착한 칸에 또 이벤트가 있으면 이어서 처리하되, 무한 루프 방지를 위해 chain depth를 최대 10으로 제한한다.
- 이동 목표로 쓰이는 marker 칸은 markerOnly: true로 두어 이벤트가 무한 반복되지 않게 한다.
- 주사위 이동 중, 이벤트 애니메이션 중, 페르마타 쉬는 턴 처리 중에는 주사위 버튼과 이동 버튼을 비활성화한다.
- 게임 규칙 함수는 UI와 분리해 단위 테스트가 가능하게 만든다.

최종 산출물:
- 실행 가능한 Vite React 프로젝트
- 명확한 폴더 구조
- boardCells.ts 데이터
- rules.ts 규칙 엔진
- CSS 애니메이션
- README.md
- 간단한 규칙 엔진 테스트
- npm run dev로 실행 가능
```

---

## 1. 프로젝트 생성 프롬프트

```text
React + TypeScript + Vite 기반으로 “음악의 마블” 프로젝트를 생성해줘.

요구사항:
1. 프로젝트 구조는 아래처럼 만들어라.

src/
  assets/
  components/
    Board.tsx
    BoardCell.tsx
    PlayerToken.tsx
    DicePanel.tsx
    EventOverlay.tsx
    LearningCard.tsx
    EventLog.tsx
  data/
    boardCells.ts
    symbolMeta.ts
  game/
    types.ts
    rules.ts
    reducer.ts
    movement.ts
  styles/
    globals.css
    board.css
    animations.css
  test/
    rules.test.ts
  App.tsx
  main.tsx

public/
  assets/
    symbols/

2. package.json scripts:
   - dev
   - build
   - preview
   - test

3. UI는 먼저 동작하는 MVP를 우선하고, 이후 애니메이션을 강화할 수 있게 컴포넌트를 작게 나눠라.
4. CSS는 globals.css, board.css, animations.css로 분리하라.
5. 모든 타입은 TypeScript로 엄격하게 작성하라.
6. any 사용은 피하라.
```

---

## 2. 이미지 에셋 정리 프롬프트

```text
사용자가 제공한 음악기호 이미지를 public/assets/symbols/에 복사해 사용한다고 가정하고, 아래 파일명으로 정리해줘.

원본 파일명 예시:
- Segno.png
- Coda.png
- Fermata.png
- Repeat-Sign 1.png
- Repeat-Sign 2.png
- 1st Ending.jpg
- 2nd Ending.jpg
- 다중쉼표01.png
- 다중쉼표02.png
- 반복기호의 마블 보드게임 판 by 김영걸(A2).png

웹앱에서 사용할 권장 파일명:
- /assets/symbols/segno.png
- /assets/symbols/coda.png
- /assets/symbols/fermata.png
- /assets/symbols/repeat-start.png
- /assets/symbols/repeat-end.png
- /assets/symbols/first-ending.jpg
- /assets/symbols/second-ending.jpg
- /assets/symbols/multi-rest.png
- /assets/symbols/board-bg.png

주의사항:
1. 실제 배포 환경에서 한글, 공백, 괄호가 있는 파일명은 경로 문제가 생길 수 있으므로 영문 kebab-case로 바꿔라.
2. 이미지가 없으면 반드시 fallback 텍스트를 표시하라.
3. 보드 배경 이미지 board-bg.png는 선택 사항이다. MVP에서는 CSS grid 보드를 만들고, 이후 board-bg.png를 배경으로 깔 수 있게 구조를 열어둬라.
4. 각 심볼에는 alt 텍스트를 넣어라.
```

---

## 3. 보드 구조 설계 프롬프트

```text
40칸 사각형 테두리 보드를 구현해줘.

보드 좌표 규칙:
- CSS grid 11 x 11을 사용한다.
- index 0은 좌상단 Start 칸이다.
- index 0~10: 맨 위 줄, 왼쪽에서 오른쪽으로 이동
- index 11~19: 오른쪽 줄, 위에서 아래로 이동
- index 20~30: 맨 아래 줄, 오른쪽에서 왼쪽으로 이동
- index 31~39: 왼쪽 줄, 아래에서 위로 이동
- 중앙 9 x 9 영역에는 게임 제목, 설명, 현재 이벤트 카드를 배치한다.

좌표 계산 함수:
- index가 0~10이면 row=1, col=index+1
- index가 11~19이면 row=index-9, col=11
- index가 20~30이면 row=11, col=31-index
- index가 31~39이면 row=41-index, col=1

보드 이동 규칙:
- 앞으로 한 칸 이동은 position = (position + 1) % boardCells.length 이다.
- ArrowRight 키는 물리적으로 오른쪽 이동이 아니라 “보드 경로상 다음 칸” 이동이다.
- 이동 애니메이션은 현재 칸에서 다음 칸으로 1칸씩 부드럽게 이동한다.

시각 디자인:
- 각 칸은 둥근 모서리 카드처럼 보이게 한다.
- 칸마다 index, 이름, 심볼 이미지, 간단한 효과 텍스트를 표시한다.
- Start, 일반 칸, 이벤트 칸, marker 칸의 색감을 다르게 한다.
- 현재 플레이어가 있는 칸은 pulsing outline을 준다.
- 이벤트 대상 칸은 target glow를 준다.
```

---

## 4. TypeScript 타입 설계 프롬프트

```text
src/game/types.ts를 작성해줘.

반드시 포함할 타입:

```ts
export type CellKind =
  | 'START'
  | 'NORMAL'
  | 'MULTI_REST'
  | 'REPEAT_START'
  | 'REPEAT_END'
  | 'DAL_SEGNO'
  | 'SEGNO'
  | 'CODA'
  | 'DA_CAPO'
  | 'FIRST_ENDING'
  | 'SECOND_ENDING'
  | 'FERMATA'
  | 'DOUBLE_SEGNO'
  | 'DOUBLE_CODA'
  | 'FINE';

export type GamePhase =
  | 'READY'
  | 'ROLLING'
  | 'WAITING_STEP'
  | 'MOVING'
  | 'RESOLVING_EVENT'
  | 'SKIPPING'
  | 'GAME_OVER';

export interface BoardCell {
  index: number;
  kind: CellKind;
  title: string;
  shortLabel: string;
  description: string;
  gameEffect: string;
  imageSrc?: string;
  fallbackSymbol: string;
  markerOnly?: boolean;
  count?: number;
  pairId?: string;
  occurrence?: 1 | 2;
}

export interface GameState {
  position: number;
  previousPosition: number;
  diceValue: number | null;
  remainingSteps: number;
  skipTurns: number;
  phase: GamePhase;
  activeEvent: ResolvedEvent | null;
  eventLog: string[];
  chainDepth: number;
  turnCount: number;
}

export type ResolvedEventType =
  | 'NONE'
  | 'MOVE_FORWARD'
  | 'JUMP_TO_INDEX'
  | 'SKIP_TURNS'
  | 'GAME_FINISH';

export interface ResolvedEvent {
  type: ResolvedEventType;
  sourceIndex: number;
  targetIndex?: number;
  steps?: number;
  skipTurns?: number;
  title: string;
  message: string;
  animationClass: string;
}
```

주의:
- 필요하면 타입을 더 추가해도 되지만 위 타입의 의도는 유지하라.
- 음악기호 규칙과 UI 표시 데이터가 분리되도록 설계하라.
```

---

## 5. boardCells 데이터 작성 프롬프트

```text
src/data/boardCells.ts를 작성해줘.

조건:
1. 총 40칸이다.
2. index는 0부터 39까지 중복 없이 들어간다.
3. 모든 요구 음악기호가 최소 1회 이상 등장해야 한다.
4. target 역할만 하는 칸은 markerOnly: true를 사용한다.
5. pairId 또는 occurrence를 사용해 첫 번째/두 번째 코다, 더블세뇨, 더블코다를 구분한다.
6. UI에 표시할 설명과 게임 효과 문구를 함께 넣는다.

권장 배치:
- 0: START
- 3: DA_CAPO
- 5: REPEAT_START, markerOnly true
- 8: REPEAT_END, pairId repeat-a
- 10: FIRST_ENDING
- 12: SECOND_ENDING, markerOnly true
- 14: SEGNO, markerOnly true
- 16: CODA occurrence 1
- 19: FERMATA
- 21: CODA occurrence 2, markerOnly true
- 23: DAL_SEGNO
- 25: DOUBLE_SEGNO occurrence 1
- 28: DOUBLE_SEGNO occurrence 2, markerOnly true
- 30: MULTI_REST count 4
- 33: DOUBLE_CODA occurrence 1
- 36: DOUBLE_CODA occurrence 2, markerOnly true
- 39: FINE

나머지 칸은 NORMAL로 채운다.

각 칸의 설명 예시:
- 다중쉼표: “숫자만큼 여러 마디를 쉬라는 뜻이에요.” / 게임 효과: “4칸 앞으로 이동!”
- 도돌이표: “정해진 구간을 다시 연주하라는 뜻이에요.” / 게임 효과: “Pre 도돌이표 칸으로 돌아가요.”
- D.S.: “Dal Segno, 세뇨 표시로 돌아가라는 뜻이에요.” / 게임 효과: “세뇨 칸으로 이동!”
- 세뇨: “D.S.가 돌아오는 표식이에요.” / 게임 효과: “목표 지점이에요.”
- 코다: “Coda 구간으로 건너뛰라는 뜻이에요.” / 게임 효과: “두 번째 코다 칸으로 이동!”
- D.C.: “Da Capo, 처음으로 돌아가라는 뜻이에요.” / 게임 효과: “Start로 이동!”
- 제 1괄호: “첫 번째 반복에서 연주하는 끝맺음이에요.” / 게임 효과: “제 2괄호 칸으로 이동!”
- 제 2괄호: “두 번째 반복에서 연주하는 끝맺음이에요.” / 게임 효과: “목표 지점이에요.”
- 페르마타: “음을 더 길게 머무르라는 뜻이에요.” / 게임 효과: “2번 쉬기!”
- 더블세뇨: “두 개의 세뇨 표식이에요.” / 게임 효과: “두 번째 더블세뇨로 이동!”
- 더블코다: “두 개의 코다 표식이에요.” / 게임 효과: “두 번째 더블코다로 이동!”
```

---

## 6. 규칙 엔진 구현 프롬프트

```text
src/game/rules.ts를 작성해줘.

resolveCellEvent(boardCells, position): ResolvedEvent를 구현하라.

규칙:
1. NORMAL, START, SEGNO marker, SECOND_ENDING marker, 두 번째 CODA marker, 두 번째 DOUBLE_SEGNO marker, 두 번째 DOUBLE_CODA marker는 NONE 이벤트를 반환한다.
2. MULTI_REST이고 count가 4이면 MOVE_FORWARD 이벤트를 반환한다.
   - steps: 4
   - animationClass: 'fx-multi-rest'
3. REPEAT_END는 같은 pairId를 가진 REPEAT_START를 찾아 JUMP_TO_INDEX를 반환한다.
   - targetIndex: REPEAT_START index
   - animationClass: 'fx-repeat-rewind'
4. DAL_SEGNO는 SEGNO 칸을 찾아 JUMP_TO_INDEX를 반환한다.
   - targetIndex: SEGNO index
   - animationClass: 'fx-dal-segno'
5. CODA occurrence 1은 CODA occurrence 2를 찾아 JUMP_TO_INDEX를 반환한다.
   - animationClass: 'fx-coda-portal'
6. DA_CAPO는 index 0으로 JUMP_TO_INDEX를 반환한다.
   - animationClass: 'fx-da-capo'
7. FIRST_ENDING은 SECOND_ENDING을 찾아 JUMP_TO_INDEX를 반환한다.
   - animationClass: 'fx-ending-bridge'
8. FERMATA는 SKIP_TURNS를 반환한다.
   - skipTurns: 2
   - animationClass: 'fx-fermata-freeze'
9. DOUBLE_SEGNO occurrence 1은 occurrence 2로 JUMP_TO_INDEX를 반환한다.
   - animationClass: 'fx-double-segno'
10. DOUBLE_CODA occurrence 1은 occurrence 2로 JUMP_TO_INDEX를 반환한다.
   - animationClass: 'fx-double-coda'
11. FINE은 GAME_FINISH 이벤트를 반환한다.
12. target을 찾지 못하면 앱이 죽지 않게 NONE 이벤트와 경고 메시지를 반환한다.

추가 함수:
- getNextPosition(position, boardLength)
- getPositionAfterSteps(position, steps, boardLength)
- findCellIndexByKind(boardCells, kind)
- findPairedCellIndex(boardCells, sourceCell)

테스트:
- REPEAT_END가 REPEAT_START로 이동하는지
- DAL_SEGNO가 SEGNO로 이동하는지
- DA_CAPO가 0으로 이동하는지
- FIRST_ENDING이 SECOND_ENDING으로 이동하는지
- FERMATA가 skipTurns 2를 반환하는지
- MULTI_REST가 steps 4를 반환하는지
- 두 번째 marker 칸들은 NONE인지
```

---

## 7. 게임 상태 reducer 구현 프롬프트

```text
src/game/reducer.ts를 작성해줘.

useReducer 기반으로 게임 상태를 관리한다.

액션:
- ROLL_DICE_START
- ROLL_DICE_COMPLETE, payload diceValue
- STEP_FORWARD_START
- STEP_FORWARD_COMPLETE
- RESOLVE_EVENT_START
- APPLY_EVENT_MOVE, payload targetIndex 또는 steps
- APPLY_SKIP_TURNS, payload skipTurns
- EVENT_COMPLETE
- SKIP_TURN
- RESET_GAME
- FINISH_GAME
- ADD_LOG

상태 흐름:
1. READY 상태에서 주사위 버튼 클릭
2. skipTurns > 0이면 실제 주사위를 굴리지 않고 SKIP_TURN 처리
   - skipTurns 1 감소
   - 로그: “페르마타로 한 번 쉬었어요. 남은 쉬기: n”
   - skipTurns가 0이 되면 READY
3. skipTurns가 0이면 ROLLING
4. 0.7초 주사위 애니메이션 후 diceValue 결정
5. remainingSteps = diceValue, phase = WAITING_STEP
6. ArrowRight 또는 한 칸 이동 버튼으로 STEP_FORWARD_START
7. 0.25~0.4초 이동 애니메이션 후 STEP_FORWARD_COMPLETE
8. remainingSteps가 0보다 크면 다시 WAITING_STEP
9. remainingSteps가 0이면 RESOLVING_EVENT
10. resolveCellEvent 실행
11. 이벤트가 NONE이면 EVENT_COMPLETE 후 READY
12. MOVE_FORWARD이면 해당 steps만큼 자동 또는 단계적 이벤트 이동을 수행하고, 도착 후 다시 resolveCellEvent
13. JUMP_TO_INDEX이면 특수 애니메이션 후 targetIndex로 이동하고, 도착 후 다시 resolveCellEvent
14. SKIP_TURNS이면 skipTurns += 2 후 EVENT_COMPLETE
15. GAME_FINISH이면 GAME_OVER
16. chainDepth가 10을 넘으면 이벤트 연쇄를 중단하고 READY로 복귀

중요:
- reducer는 순수 함수로 유지한다.
- setTimeout 같은 비동기 처리는 컴포넌트나 custom hook에서 처리한다.
- 로그는 최신 20개만 유지한다.
```

---

## 8. 주사위 인터랙션 프롬프트

```text
DicePanel 컴포넌트를 만들어줘.

요구사항:
1. “주사위 굴리기” 버튼이 있다.
2. 주사위가 굴러가는 동안 0.7초 동안 1~6 눈이 빠르게 바뀌는 CSS/React 애니메이션을 보여준다.
3. 주사위 결과가 확정되면 큰 숫자와 주사위 면을 표시한다.
4. 남은 이동 수 remainingSteps를 표시한다.
5. remainingSteps > 0이면 “ArrowRight 또는 한 칸 이동 버튼으로 이동하세요” 안내를 표시한다.
6. 주사위 버튼 비활성 조건:
   - phase가 READY가 아닐 때
   - remainingSteps > 0일 때
   - phase가 MOVING 또는 RESOLVING_EVENT일 때
   - GAME_OVER일 때
7. 한 칸 이동 버튼 비활성 조건:
   - phase가 WAITING_STEP이 아닐 때
   - remainingSteps <= 0일 때
8. 키보드 이벤트:
   - ArrowRight: 한 칸 이동
   - Space 또는 Enter: READY 상태에서 주사위 굴리기
9. 모바일에서도 버튼이 충분히 크게 보이게 한다.
10. 주사위 결과는 Math.random으로 구현하되 함수로 분리해 테스트 가능하게 한다.
```

---

## 9. 플레이어 말 애니메이션 프롬프트

```text
PlayerToken 컴포넌트를 만들어줘.

캐릭터 컨셉:
- 귀여운 음악요정 또는 음표 캐릭터 느낌
- 둥근 얼굴, 작은 음표 꼬리, 살짝 통통 튀는 동작
- CSS만으로 구현해도 되고, 간단한 SVG를 inline으로 사용해도 된다.

이동 애니메이션:
1. 한 칸 이동할 때 token-hop 애니메이션을 적용한다.
2. 애니메이션 느낌:
   - 살짝 작아졌다가 커짐
   - 위로 8~14px 튀어오름
   - 도착 시 작은 sparkle particle
3. 이동 중에는 말 아래에 작은 shadow가 늘었다 줄어든다.
4. 이벤트 이동에서는 각 이벤트별 class를 추가해 다른 효과를 보여준다.

CSS keyframes 이름:
- token-idle-bounce
- token-hop
- token-land-pop
- token-rewind-spin
- token-portal-warp
- token-freeze
- token-confetti-pop

접근성:
- prefers-reduced-motion: reduce에서는 큰 움직임을 줄이고 opacity/outline 변화 위주로 대체한다.
```

---

## 10. 음악기호별 CSS 이벤트 애니메이션 프롬프트

```text
src/styles/animations.css에 음악기호별 이벤트 애니메이션을 작성해줘.

공통 구조:
- EventOverlay 컴포넌트가 activeEvent.animationClass를 root class로 받는다.
- overlay는 보드 위에 absolute/fixed로 뜬다.
- 이벤트 시작 시 1~1.5초 동안 보드 전체 또는 해당 칸 주변에 화려한 효과를 준다.
- 너무 과하면 게임 진행이 불편하므로 최대 1.5초 안에 끝낸다.

이벤트별 요구사항:

1. 다중쉼표 fx-multi-rest
   - 화면에 “4칸 앞으로!” 텍스트가 리듬감 있게 나타난다.
   - 4개의 작은 음표/쉼표 파티클이 앞으로 날아가는 느낌.
   - board cell들이 순서대로 4칸 flash.

2. 도돌이표 fx-repeat-rewind
   - 원형 화살표가 뒤로 감기는 느낌.
   - 보드 가장자리에 반시계 방향 빛줄기.
   - 플레이어 말은 살짝 회전하며 target으로 이동.

3. 달세뇨 fx-dal-segno
   - 큰 Segno 심볼이 중앙에 나타나고 반짝이는 포털이 열린다.
   - target 세뇨 칸에 spotlight.
   - 텍스트: “D.S. → 세뇨로!”

4. 코다 fx-coda-portal
   - Coda 심볼 두 개가 연결되는 포털 터널.
   - 첫 번째 코다에서 두 번째 코다로 빛줄기가 이어진다.
   - 텍스트: “Coda Jump!”

5. 다카포 fx-da-capo
   - 악보 페이지가 처음으로 휙 넘어가는 느낌.
   - Start 칸이 초록빛으로 pulse.
   - 텍스트: “Da Capo: 처음으로!”

6. 제 1괄호 fx-ending-bridge
   - 1번 괄호에서 2번 괄호로 다리가 놓이는 느낌.
   - 두 칸 사이에 dotted line 또는 rainbow bridge.
   - 텍스트: “1번 엔딩을 지나 2번 엔딩으로!”

7. 페르마타 fx-fermata-freeze
   - 화면이 잠깐 파랗게 얼어붙고, 큰 페르마타가 천천히 확대.
   - “2번 쉬기” 텍스트와 Zzz 아이콘.
   - 버튼들은 잠깐 disabled 느낌.

8. 더블세뇨 fx-double-segno
   - Segno 심볼 2개가 회전하며 target으로 연결.
   - 보라색/별빛 느낌.
   - 텍스트: “Double Segno!”

9. 더블코다 fx-double-coda
   - Coda 심볼 2개가 팡 하고 분리된 뒤 두 번째 코다로 빨려 들어감.
   - 텍스트: “Double Coda!”

10. Fine fx-fine-finish
   - 축하 confetti.
   - 텍스트: “Fine! 완주했어요!”

반드시 넣을 CSS:
- @keyframes overlay-pop
- @keyframes sparkle-float
- @keyframes portal-pulse
- @keyframes rewind-ring
- @keyframes freeze-glow
- @keyframes bridge-draw
- @keyframes confetti-fall

prefers-reduced-motion 대응:
- 모든 큰 transform animation을 줄이고 fade/highlight 위주로 대체한다.
```

---

## 11. 학습 카드 프롬프트

```text
LearningCard 컴포넌트를 만들어줘.

표시 내용:
1. 기호 이름
2. 이미지 또는 fallback symbol
3. 실제 음악이론 의미
4. 게임에서 발생한 효과
5. “한 줄 기억법”
6. 닫기 버튼 또는 자동 닫힘

예시 기억법:
- 다중쉼표: “숫자가 보이면 그만큼 쉬어요!”
- 도돌이표: “두 점과 굵은 선은 다시 돌아가는 문!”
- D.S.: “D.S.는 Segno 표지판으로 가라는 신호!”
- 세뇨: “세뇨는 돌아올 위치를 알려주는 표지판!”
- 코다: “코다는 음악의 특별한 출구!”
- D.C.: “Capo는 머리, 즉 처음으로!”
- 제 1괄호: “첫 번째 반복에서만 들어가는 방!”
- 제 2괄호: “두 번째 반복에서 들어가는 방!”
- 페르마타: “잠깐 멈춰서 더 길게!”
- 더블세뇨: “세뇨 표지판이 두 개라 더 특별한 이동!”
- 더블코다: “코다 출구가 두 개라 더 멀리 점프!”

동작:
- 이벤트가 발생하면 카드가 나타난다.
- 카드가 뜨는 동안에도 게임 흐름이 막히지 않게 하되, 이벤트 애니메이션 중에는 이동 버튼은 비활성화한다.
- 카드에는 “계속하기” 버튼을 넣는다.
- 유아/초등학생도 이해할 수 있는 문장으로 작성한다.
```

---

## 12. EventOverlay 프롬프트

```text
EventOverlay 컴포넌트를 만들어줘.

props:
- event: ResolvedEvent | null
- sourceCell?: BoardCell
- targetCell?: BoardCell

요구사항:
1. event가 null이면 렌더링하지 않는다.
2. event.animationClass에 맞춰 overlay class를 설정한다.
3. 중앙에는 event.title과 event.message를 크게 보여준다.
4. sourceCell과 targetCell이 있으면 “source → target” 정보를 작게 보여준다.
5. 시각 효과는 CSS pseudo-element나 child div로 구현한다.
6. overlay는 pointer-events: none을 기본으로 한다.
7. 학습 카드와 겹쳐도 보기 좋게 z-index를 조정한다.
8. 이벤트별로 다른 이모지/아이콘을 표시한다.

이벤트별 중앙 텍스트 예시:
- MULTI_REST: “다중쉼표! 4칸 앞으로”
- REPEAT_END: “도돌이표! 반복 시작으로”
- DAL_SEGNO: “달세뇨! 세뇨로 이동”
- CODA: “코다! 두 번째 코다로”
- DA_CAPO: “다카포! 처음으로”
- FIRST_ENDING: “제 1괄호! 제 2괄호로”
- FERMATA: “페르마타! 2번 쉬기”
- DOUBLE_SEGNO: “더블세뇨! 두 번째 표시로”
- DOUBLE_CODA: “더블코다! 두 번째 표시로”
```

---

## 13. App 통합 프롬프트

```text
App.tsx에서 전체 게임을 통합해줘.

구성:
- Header: 제목 “음악의 마블”과 짧은 설명
- GameStatusBar: phase, diceValue, remainingSteps, skipTurns, turnCount
- MainLayout:
  - Board
  - DicePanel
  - LearningCard
  - EventLog
- EventOverlay

핵심 흐름 구현:
1. rollDice 함수
   - READY 또는 skipTurns 처리 가능 상태에서만 실행
   - skipTurns > 0이면 skip 처리
   - 아니면 ROLLING → 0.7초 후 diceValue 확정
2. stepForward 함수
   - WAITING_STEP에서만 실행
   - 현재 position에서 다음 position으로 한 칸 이동
   - 0.3초 후 remainingSteps 감소
   - remainingSteps가 0이면 resolveCurrentCell 실행
3. resolveCurrentCell 함수
   - resolveCellEvent 호출
   - NONE이면 READY
   - MOVE_FORWARD이면 specialMoveForward 실행
   - JUMP_TO_INDEX이면 specialJumpToIndex 실행
   - SKIP_TURNS이면 skipTurns 증가 후 READY
   - GAME_FINISH이면 GAME_OVER
4. specialMoveForward 함수
   - 다중쉼표 같은 이벤트에서 steps만큼 자동으로 한 칸씩 빠르게 이동
   - 각 칸 0.18~0.25초
   - 도착 후 resolveCurrentCell 재호출
5. specialJumpToIndex 함수
   - 포털/되감기 애니메이션 0.8초
   - targetIndex로 이동
   - 도착 후 resolveCurrentCell 재호출
6. chainDepth가 10 이상이면 이벤트 연쇄 중단
7. Reset 버튼은 모든 상태를 초기화

주의:
- setTimeout은 clearTimeout cleanup을 처리한다.
- 빠르게 버튼을 연타해도 상태가 꼬이지 않게 disabled와 phase 체크를 철저히 한다.
- window keydown 이벤트는 useEffect로 등록하고 cleanup한다.
```

---

## 14. 보드 컴포넌트 프롬프트

```text
Board.tsx와 BoardCell.tsx를 구현해줘.

Board props:
- boardCells
- currentPosition
- previousPosition
- activeEvent
- highlightedTargetIndex
- onCellClick optional debug용

BoardCell 표시:
- index
- shortLabel
- imageSrc가 있으면 이미지
- fallbackSymbol
- title
- gameEffect 짧은 문구

className 규칙:
- cell-kind-start
- cell-kind-normal
- cell-kind-event
- cell-marker-only
- cell-current
- cell-source-highlight
- cell-target-highlight
- cell-recently-passed

중앙 영역:
- 11x11 grid의 row 2 / col 2부터 row 10 / col 10까지 차지하는 center panel
- 제목 “반복기호의 마블”
- 안내: “주사위를 굴리고, 우측 방향키로 한 칸씩 이동하세요!”
- 현재 이벤트 요약

반응형:
- 데스크톱: 보드와 패널을 좌우 배치
- 태블릿/모바일: 보드 위, 조작 패널 아래
- 보드는 min(92vw, 760px) 정사각형
- 칸 글씨는 clamp를 사용해 크기를 조정
```

---

## 15. 교육용 이벤트 로그 프롬프트

```text
EventLog 컴포넌트를 만들어줘.

요구사항:
1. 최근 이벤트 20개 표시.
2. 최신 이벤트가 위에 오게 한다.
3. 로그 예시:
   - “🎲 주사위 5! 5칸 이동하세요.”
   - “➡️ 12번 칸으로 이동.”
   - “🔁 도돌이표: 5번 Pre 도돌이표로 이동!”
   - “⏸ 페르마타: 다음 2번 쉬기!”
4. 어린이에게 친근한 말투를 사용한다.
5. 로그가 없으면 “아직 이벤트가 없어요.” 표시.
```

---

## 16. 스타일 가이드 프롬프트

```text
전체 UI 스타일을 다음 방향으로 잡아줘.

분위기:
- 음악 교실 + 보드게임 + 귀여운 아케이드
- 밝고 명랑한 색상
- 초등학생도 사용하기 쉬운 큰 버튼과 큰 글씨
- 복잡한 이론 앱이 아니라 놀이처럼 느껴지게

색상 토큰 예시:
- --color-bg: #fff8e8
- --color-board: #ffffff
- --color-primary: #4f7cff
- --color-secondary: #ffb84f
- --color-accent: #ff5c8a
- --color-success: #43c77a
- --color-warning: #ffd166
- --color-danger: #ef476f
- --color-ink: #243047

버튼:
- 둥근 pill shape
- hover 시 살짝 위로 뜨기
- active 시 눌리는 느낌
- disabled 시 opacity와 cursor 처리

보드 칸:
- 이벤트 칸은 색 띠 또는 심볼 배경
- markerOnly 칸은 “목표 지점” 배지 표시
- 현재 칸은 두꺼운 outline과 작은 pulse

폰트:
- 시스템 sans-serif 기본
- 한글 가독성 우선
- 숫자와 기호는 크게
```

---

## 17. 테스트 작성 프롬프트

```text
Vitest로 src/test/rules.test.ts를 작성해줘.

테스트 케이스:
1. getNextPosition(39, 40)은 0이다.
2. getPositionAfterSteps(38, 4, 40)은 2이다.
3. MULTI_REST count 4는 MOVE_FORWARD와 steps 4를 반환한다.
4. REPEAT_END는 같은 pairId의 REPEAT_START index를 targetIndex로 반환한다.
5. DAL_SEGNO는 SEGNO index로 이동한다.
6. CODA occurrence 1은 CODA occurrence 2로 이동한다.
7. CODA occurrence 2 markerOnly는 NONE이다.
8. DA_CAPO는 targetIndex 0을 반환한다.
9. FIRST_ENDING은 SECOND_ENDING index로 이동한다.
10. FERMATA는 SKIP_TURNS와 skipTurns 2를 반환한다.
11. DOUBLE_SEGNO occurrence 1은 occurrence 2로 이동한다.
12. DOUBLE_CODA occurrence 1은 occurrence 2로 이동한다.
13. FINE은 GAME_FINISH를 반환한다.
14. target이 없는 경우에도 throw하지 않고 NONE 또는 안전한 fallback을 반환한다.
```

---

## 18. README 작성 프롬프트

```text
README.md를 작성해줘.

포함 내용:
1. 프로젝트 소개
2. 음악의 마블 게임 규칙
3. 조작법
   - 주사위 굴리기
   - ArrowRight로 한 칸씩 이동
   - 모바일에서는 한 칸 이동 버튼
4. 음악기호별 게임 효과 표
5. 설치 및 실행 방법
   - npm install
   - npm run dev
   - npm run test
6. 이미지 에셋 넣는 위치
7. 폴더 구조
8. 향후 개선 아이디어
   - 2~4인 멀티플레이
   - 사운드 효과
   - 교사용 보드 편집기
   - 난이도별 보드
   - 학습 퀴즈 모드
```

---

## 19. 실제 음악기호 규칙 표

| 음악기호 | 실제 의미 | 게임 효과 | 이벤트 타입 | 애니메이션 |
|---|---|---|---|---|
| 다중쉼표 4 | 숫자만큼 여러 마디를 쉼 | 4칸 앞으로 이동 | MOVE_FORWARD | fx-multi-rest |
| Pre 도돌이표 | 반복 시작 지점 | 목표 지점 | NONE | target glow |
| Post 도돌이표 | 반복 끝 지점 | Pre 도돌이표로 이동 | JUMP_TO_INDEX | fx-repeat-rewind |
| 달세뇨 D.S. | 세뇨로 돌아감 | 세뇨 칸으로 이동 | JUMP_TO_INDEX | fx-dal-segno |
| 세뇨 | D.S.의 목표 표식 | 목표 지점 | NONE | target glow |
| 코다 1 | 코다 구간으로 이동 | 코다 2로 이동 | JUMP_TO_INDEX | fx-coda-portal |
| 코다 2 | 코다의 목표 지점 | 목표 지점 | NONE | target glow |
| 다카포 D.C. | 처음으로 돌아감 | Start로 이동 | JUMP_TO_INDEX | fx-da-capo |
| 제 1괄호 | 첫 번째 반복의 끝맺음 | 제 2괄호로 이동 | JUMP_TO_INDEX | fx-ending-bridge |
| 제 2괄호 | 두 번째 반복의 끝맺음 | 목표 지점 | NONE | target glow |
| 페르마타 | 음을 길게 머무름 | 2번 쉬기 | SKIP_TURNS | fx-fermata-freeze |
| 더블세뇨 1 | 두 번째 더블세뇨로 이동 | 더블세뇨 2로 이동 | JUMP_TO_INDEX | fx-double-segno |
| 더블세뇨 2 | 목표 지점 | 목표 지점 | NONE | target glow |
| 더블코다 1 | 두 번째 더블코다로 이동 | 더블코다 2로 이동 | JUMP_TO_INDEX | fx-double-coda |
| 더블코다 2 | 목표 지점 | 목표 지점 | NONE | target glow |
| Fine | 끝 | 게임 완료 | GAME_FINISH | fx-fine-finish |

---

## 20. 구현 완료 기준 체크리스트

```text
아래 체크리스트가 모두 통과되도록 구현해줘.

기능 체크:
- [ ] npm install 후 npm run dev가 정상 실행된다.
- [ ] 40칸 보드가 사각형 테두리 형태로 표시된다.
- [ ] 플레이어 말이 현재 칸 위에 표시된다.
- [ ] 주사위 굴리기 버튼이 작동한다.
- [ ] 주사위 결과가 1~6으로 표시된다.
- [ ] ArrowRight를 누르면 한 칸씩만 이동한다.
- [ ] 모바일용 한 칸 이동 버튼도 작동한다.
- [ ] 남은 이동 수가 정확히 줄어든다.
- [ ] 이동이 끝난 뒤에만 칸 이벤트가 실행된다.
- [ ] 다중쉼표 4는 4칸 앞으로 이동한다.
- [ ] 도돌이표는 Pre 도돌이표로 이동한다.
- [ ] D.S.는 세뇨로 이동한다.
- [ ] 코다는 두 번째 코다로 이동한다.
- [ ] D.C.는 Start로 이동한다.
- [ ] 제 1괄호는 제 2괄호로 이동한다.
- [ ] 페르마타는 2번 쉬기를 적용한다.
- [ ] 더블세뇨는 두 번째 더블세뇨로 이동한다.
- [ ] 더블코다는 두 번째 더블코다로 이동한다.
- [ ] 이벤트마다 학습 카드가 표시된다.
- [ ] 이벤트마다 다른 CSS 애니메이션이 표시된다.
- [ ] 이벤트 로그가 남는다.
- [ ] 리셋 버튼이 작동한다.
- [ ] rules.test.ts가 통과한다.

품질 체크:
- [ ] TypeScript 에러가 없다.
- [ ] 빠르게 버튼을 연타해도 상태가 꼬이지 않는다.
- [ ] 이벤트 연쇄가 무한 반복되지 않는다.
- [ ] 이미지가 없어도 fallback symbol이 보인다.
- [ ] 모바일 화면에서 조작 가능하다.
- [ ] prefers-reduced-motion 대응이 있다.
```

---

## 21. 2차 개선 프롬프트: 실제 보드 이미지 배경 적용

```text
MVP가 완성되면 사용자가 제공한 “반복기호의 마블 보드게임 판 by 김영걸(A2).png”를 board-bg.png로 사용해 실제 보드판 느낌을 강화해줘.

요구사항:
1. CSS grid 보드가 기본 모드다.
2. 설정값 useBoardBackgroundImage가 true이면 board-bg.png를 보드 중앙 또는 전체 배경으로 깐다.
3. 배경 이미지는 object-fit: contain으로 찌그러지지 않게 표시한다.
4. 기존 40칸 cell overlay는 계속 클릭/하이라이트/말 위치 계산이 가능해야 한다.
5. 배경 이미지 때문에 글자가 안 보이면 cell에 반투명 흰색 배경을 준다.
6. 보드 배경이 로딩 실패해도 CSS grid 보드는 정상 동작해야 한다.
```

---

## 22. 2차 개선 프롬프트: 사운드 효과

```text
게임에 짧은 사운드 효과를 추가해줘.

사운드 종류:
- 주사위 굴리기: dice-roll
- 한 칸 이동: step-pop
- 이벤트 발생: magic-chime
- 페르마타: soft-freeze
- Fine: celebration

조건:
1. 기본값은 mute다.
2. 사용자가 사운드 버튼을 눌러 켜고 끌 수 있다.
3. 소리 파일이 없으면 Web Audio API의 짧은 beep로 fallback한다.
4. 어린이 교육용이므로 소리는 작고 부드럽게 한다.
5. prefers-reduced-motion과 별개로 prefers-reduced-audio는 없으므로 명확한 mute 버튼을 제공한다.
```

---

## 23. 2차 개선 프롬프트: 2~4인 플레이

```text
MVP 단일 플레이가 안정화된 후 2~4인 플레이를 추가해줘.

요구사항:
1. 플레이어 수 선택: 1~4명
2. 각 플레이어는 다른 색의 말 사용
3. 현재 턴 플레이어만 주사위를 굴릴 수 있음
4. 페르마타 skipTurns는 플레이어별로 따로 관리
5. 이벤트 로그에는 플레이어 이름 표시
6. 같은 칸에 여러 말이 있으면 살짝 겹쳐 보이게 offset 처리
7. Fine에 먼저 도착한 플레이어가 승리
8. 기존 단일 플레이 규칙 엔진은 재사용
```

---

## 24. 한 번에 붙여넣는 압축 실행 프롬프트

```text
“음악의 마블”이라는 React + TypeScript + Vite 웹앱을 만들어줘.

부르마블 형식의 40칸 사각형 보드에서 플레이어 말이 한 방향으로만 전진하는 음악이론 학습 게임이다. 주사위 굴리기 버튼으로 1~6을 뽑고, 플레이어는 ArrowRight 또는 화면의 “한 칸 이동” 버튼을 눌러 나온 숫자만큼 한 칸씩 이동한다. 이동이 끝난 뒤 도착한 칸의 음악기호 이벤트를 실행한다.

구현할 기호 규칙은 다음과 같다. 다중쉼표 4는 4칸 앞으로 이동, 도돌이표는 Pre 도돌이표 칸으로 이동, 달세뇨는 세뇨 칸으로 이동, 세뇨는 marker, 코다는 두 번째 코다 칸으로 이동, 다카포는 Start로 이동, 제 1괄호는 제 2괄호로 이동, 제 2괄호는 marker, 페르마타는 2번 쉬기, 더블세뇨는 두 번째 더블세뇨로 이동, 더블코다는 두 번째 더블코다로 이동한다.

React 컴포넌트는 Board, BoardCell, PlayerToken, DicePanel, EventOverlay, LearningCard, EventLog로 분리한다. 데이터는 boardCells.ts, 음악기호 설명은 symbolMeta.ts, 규칙은 rules.ts, 상태 관리는 reducer.ts로 분리한다. 이벤트 이동은 무한 루프 방지를 위해 chainDepth 최대 10을 둔다. markerOnly 칸은 이벤트를 다시 발생시키지 않는다.

보드는 CSS grid 11x11로 만들고 index 0~39를 테두리에 배치한다. 중앙에는 제목과 안내를 둔다. 플레이어 말은 귀여운 음표 캐릭터처럼 보이게 하고, 이동 시 token-hop CSS 애니메이션을 적용한다. 음악기호 칸 도착 시 각 기호별로 fx-multi-rest, fx-repeat-rewind, fx-dal-segno, fx-coda-portal, fx-da-capo, fx-ending-bridge, fx-fermata-freeze, fx-double-segno, fx-double-coda, fx-fine-finish 애니메이션을 보여준다.

이벤트 발생 시 학습 카드에 기호 이름, 실제 음악 의미, 게임 효과, 한 줄 기억법을 표시한다. 이벤트 로그도 남긴다. 이미지 에셋은 /public/assets/symbols/에서 불러오되, 없으면 fallback symbol을 표시한다. TypeScript 타입을 엄격히 작성하고, rules.test.ts로 규칙 엔진 테스트를 만든다. npm run dev, npm run test가 통과되게 하라.
```

---

## 25. 개발 중 자주 생기는 문제와 수정 프롬프트

### 25-1. 이동 중 버튼 연타로 상태가 꼬일 때

```text
현재 음악의 마블 앱에서 이동 중 버튼을 빠르게 누르면 remainingSteps 또는 position이 꼬인다. phase 기반 guard를 강화해줘. MOVING, ROLLING, RESOLVING_EVENT 상태에서는 rollDice와 stepForward가 절대 실행되지 않게 하고, setTimeout cleanup도 추가해줘.
```

### 25-2. 이벤트가 무한 반복될 때

```text
이벤트 이동 후 target 칸에서 다시 이벤트가 반복되는 문제가 있다. markerOnly 칸은 resolveCellEvent에서 반드시 NONE을 반환하게 수정하고, chainDepth가 10 이상이면 이벤트 연쇄를 중단하는 안전장치를 추가해줘.
```

### 25-3. 모바일에서 보드가 너무 작을 때

```text
모바일 화면에서 음악의 마블 보드 칸 글씨가 너무 작다. CSS clamp, aspect-ratio, overflow 처리를 개선하고, 모바일에서는 보드 아래에 큰 조작 버튼을 sticky로 배치해줘.
```

### 25-4. 이미지 로딩 실패 시 깨질 때

```text
음악기호 이미지가 로딩되지 않으면 깨진 이미지 아이콘이 보인다. BoardCell에서 이미지 onError를 처리해 fallbackSymbol 텍스트로 대체해줘. alt 텍스트도 추가해줘.
```

### 25-5. 애니메이션이 과해서 불편할 때

```text
음악의 마블 이벤트 애니메이션이 너무 과하다. 각 이벤트 overlay 지속시간을 1.2초 이하로 줄이고, prefers-reduced-motion: reduce에서는 transform과 particle을 제거하고 opacity/highlight만 사용하도록 CSS를 수정해줘.
```
