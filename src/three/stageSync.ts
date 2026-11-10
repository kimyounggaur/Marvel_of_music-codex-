// 게임 상태의 변화(prev → next)를 3D 무대에 내릴 명령으로 번역한다.
// 무대 구현과 분리해 두어서 WebGL 없이도 테스트할 수 있다(src/test/stageSync.test.ts).
import type { GameState, ResolvedEvent } from '../game/types';
import { eventShowMs, jumpTravelMs } from './timing';

export interface StagePlayerInfo {
  id: number;
  color: string;
  position: number;
  skipTurns: number;
}

export interface StageLike {
  resetGame(players: StagePlayerInfo[]): void;
  setAttract(on: boolean): void;
  setTurn(playerId: number | null, awaitingRoll: boolean): void;
  syncPositions(players: StagePlayerInfo[]): void;
  hop(playerId: number, to: number, durationMs: number, opts: { dash: boolean; final: boolean }): void;
  jump(playerId: number, from: number, to: number, animationClass: string, durationMs: number): void;
  playEvent(event: ResolvedEvent, playerId: number, durationMs: number, travelMs: number): void;
  setFrozen(playerId: number, count: number, instant?: boolean): void;
  celebrate(playerId: number): void;
}

function stagePlayers(state: GameState): StagePlayerInfo[] {
  return state.players.map((player) => ({
    id: player.id,
    color: player.color,
    position: player.position,
    skipTurns: player.skipTurns,
  }));
}

/** 지금 주사위를 굴릴 수 있는 상태인가(무대의 주사위가 떠올라 기다린다) */
export function isAwaitingRoll(state: GameState): boolean {
  return state.phase === 'READY' && !state.setupOpen && state.winnerId === null && state.learningQueue.length === 0;
}

function applyTurn(stage: StageLike, state: GameState): void {
  const current = state.players[state.currentPlayer];
  const hidden = state.setupOpen || state.winnerId !== null || !current;
  stage.setTurn(hidden ? null : current.id, isAwaitingRoll(state));
}

export function syncStage(stage: StageLike, prev: GameState | null, next: GameState): void {
  // 처음 연결될 때, 또는 새 게임(시작·리셋)일 때는 통째로 다시 놓는다
  const isNewGame =
    prev !== null &&
    next.players !== prev.players &&
    next.turnCount === 1 &&
    next.movementTick === 0 &&
    next.phase === 'READY' &&
    next.players.every((player) => player.position === 0 && player.skipTurns === 0);

  if (prev === null || isNewGame || prev.players.length !== next.players.length) {
    stage.resetGame(stagePlayers(next));
    stage.setAttract(next.setupOpen);
    if (prev === null) {
      // 진행 중인 게임에 무대가 뒤늦게 붙은 경우(2D ↔ 3D 전환)
      for (const player of next.players) stage.setFrozen(player.id, player.skipTurns, true);
      if (next.winnerId !== null) stage.celebrate(next.winnerId);
    }
    applyTurn(stage, next);
    return;
  }

  if (prev.setupOpen !== next.setupOpen) stage.setAttract(next.setupOpen);

  // 말의 이동
  let needsResync = false;
  next.players.forEach((after, index) => {
    const before = prev.players[index];
    if (!before || before.position === after.position) return;

    if (prev.phase === 'MOVING' && prev.movement) {
      stage.hop(after.id, after.position, prev.movement.durationMs, {
        dash: prev.movement.origin === 'event',
        final: next.phase !== 'MOVING',
      });
    } else if (prev.activeEvent?.type === 'JUMP_TO_INDEX') {
      const animationClass = prev.activeEvent.animationClass;
      stage.jump(after.id, before.position, after.position, animationClass, jumpTravelMs(animationClass));
    } else {
      needsResync = true;
    }
  });
  if (needsResync) stage.syncPositions(stagePlayers(next));

  // 기호 칸 발동
  if (next.activeEvent && next.activeEvent !== prev.activeEvent) {
    const current = next.players[next.currentPlayer];
    const cls = next.activeEvent.animationClass;
    const travel = next.activeEvent.type === 'JUMP_TO_INDEX' ? jumpTravelMs(cls) : 0;
    if (current) stage.playEvent(next.activeEvent, current.id, eventShowMs(cls), travel);
  }

  // 쉬는 횟수(페르마타)
  next.players.forEach((after, index) => {
    const before = prev.players[index];
    if (before && before.skipTurns !== after.skipTurns) stage.setFrozen(after.id, after.skipTurns);
  });

  if (next.winnerId !== null && prev.winnerId === null) stage.celebrate(next.winnerId);

  const turnChanged =
    prev.currentPlayer !== next.currentPlayer ||
    prev.phase !== next.phase ||
    prev.winnerId !== next.winnerId ||
    prev.setupOpen !== next.setupOpen ||
    prev.learningQueue.length !== next.learningQueue.length;
  if (turnChanged) {
    // 새 차례가 시작될 때 상태와 화면이 어긋나 있으면(탭이 가려졌다 돌아온 경우 등) 바로잡는다
    if (next.phase === 'READY' && prev.phase !== 'READY') stage.syncPositions(stagePlayers(next));
    applyTurn(stage, next);
  }
}
