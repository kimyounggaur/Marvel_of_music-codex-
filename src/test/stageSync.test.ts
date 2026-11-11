import { describe, expect, it } from 'vitest';
import { BOARD } from '../data/boardCells';
import { gameReducer, createInitialState, type GameAction } from '../game/reducer';
import { resolveCellEvent } from '../game/rules';
import type { GameState, ResolvedEvent } from '../game/types';
import { syncStage, isAwaitingRoll, type StageLike, type StagePlayerInfo } from '../three/stageSync';
import { eventShowMs, jumpTravelMs } from '../three/timing';

/** 무대 대신 명령만 받아 적는 가짜. 말의 위치는 받은 명령대로만 움직인다. */
class FakeStage implements StageLike {
  positions = new Map<number, number>();
  frozen = new Map<number, number>();
  calls: string[] = [];
  syncs = 0;
  winner: number | null = null;
  turn: number | null = null;
  awaiting = false;
  attract = false;

  resetGame(players: StagePlayerInfo[]): void {
    this.calls.push(`reset:${players.length}`);
    this.positions.clear();
    this.frozen.clear();
    this.winner = null;
    for (const player of players) this.positions.set(player.id, player.position);
  }
  setAttract(on: boolean): void {
    this.attract = on;
  }
  setTurn(playerId: number | null, awaitingRoll: boolean): void {
    this.turn = playerId;
    this.awaiting = awaitingRoll;
  }
  syncPositions(players: StagePlayerInfo[]): void {
    // 새 차례마다 불리는 안전장치라서 연출 명령 목록에는 적지 않고 횟수만 센다
    this.syncs += 1;
    for (const player of players) this.positions.set(player.id, player.position);
  }
  hop(playerId: number, to: number, _durationMs: number, opts: { dash: boolean; final: boolean }): void {
    this.calls.push(`hop:${playerId}:${to}${opts.dash ? ':dash' : ''}${opts.final ? ':final' : ''}`);
    this.positions.set(playerId, to);
  }
  jump(playerId: number, from: number, to: number, animationClass: string): void {
    this.calls.push(`jump:${playerId}:${from}>${to}:${animationClass}`);
    this.positions.set(playerId, to);
  }
  playEvent(event: ResolvedEvent, playerId: number): void {
    this.calls.push(`event:${playerId}:${event.kind}`);
  }
  setFrozen(playerId: number, count: number): void {
    this.calls.push(`frozen:${playerId}:${count}`);
    this.frozen.set(playerId, count);
  }
  celebrate(playerId: number): void {
    this.calls.push(`win:${playerId}`);
    this.winner = playerId;
  }
}

/** 리듀서와 가짜 무대를 함께 굴리는 작은 게임 진행기 */
class Runner {
  state: GameState;
  stage = new FakeStage();

  constructor(players: number) {
    this.state = createInitialState(1, true);
    syncStage(this.stage, null, this.state);
    this.dispatch({ type: 'START_GAME', count: players });
  }

  dispatch(action: GameAction): void {
    const prev = this.state;
    this.state = gameReducer(prev, action);
    syncStage(this.stage, prev, this.state);
    // 어떤 순간에도 무대의 말 위치는 게임 상태와 같아야 한다
    for (const player of this.state.players) {
      expect(this.stage.positions.get(player.id)).toBe(player.position);
    }
  }

  /** 한 차례를 끝까지 진행한다(게임 루프가 하는 일을 시간 지연 없이 그대로) */
  turn(dice: number): void {
    this.stage.calls = [];
    this.dispatch({ type: 'ROLL_DICE_START' });
    if (this.state.phase === 'ROLLING') this.dispatch({ type: 'ROLL_DICE_COMPLETE', value: dice });
    for (let guard = 0; guard < 400; guard += 1) {
      if (this.state.phase === 'MOVING') {
        this.dispatch({ type: 'MOVE_ONE_STEP_COMPLETE' });
      } else if (this.state.phase === 'RESOLVING_EVENT') {
        if (this.state.activeEvent) {
          this.dispatch({ type: 'APPLY_ACTIVE_EVENT' });
        } else {
          const position = this.state.players[this.state.currentPlayer].position;
          this.dispatch({ type: 'RESOLVE_EVENT_RESULT', event: resolveCellEvent(BOARD, position) });
        }
      } else {
        break;
      }
    }
    if (this.state.learningQueue.length > 0) this.dispatch({ type: 'CLOSE_LEARNING' });
  }
}

describe('syncStage', () => {
  it('새 게임을 시작하면 무대를 다시 놓고 첫 차례를 알린다', () => {
    const run = new Runner(2);
    expect(run.stage.calls).toContain('reset:2');
    expect(run.stage.attract).toBe(false);
    expect(run.stage.turn).toBe(1);
    expect(run.stage.awaiting).toBe(true);
  });

  it('주사위 이동은 한 칸씩 뛰고 마지막 걸음을 표시한다', () => {
    const run = new Runner(1);
    run.turn(5);
    expect(run.stage.calls).toEqual(['hop:1:1', 'hop:1:2', 'hop:1:3', 'hop:1:4', 'hop:1:5:final']);
  });

  it('다중쉼표는 발동 연출 뒤 대시로 달리고, 연쇄된 기호도 이어서 처리한다', () => {
    const run = new Runner(1);
    run.turn(3); // 3번(다중쉼표 3) → 6번(다중쉼표 2) → 8번
    expect(run.stage.calls).toEqual([
      'hop:1:1',
      'hop:1:2',
      'hop:1:3:final',
      'event:1:MULTI_REST',
      'hop:1:4:dash',
      'hop:1:5:dash',
      'hop:1:6:dash:final',
      'event:1:MULTI_REST',
      'hop:1:7:dash',
      'hop:1:8:dash:final',
    ]);
    expect(run.state.players[0].position).toBe(8);
  });

  it('이동 기호는 종류에 맞는 점프 연출로 번역된다', () => {
    const run = new Runner(1);
    run.turn(4); // 다카포 → 출발
    expect(run.stage.calls.slice(-2)).toEqual(['event:1:DA_CAPO', 'jump:1:4>0:fx-spotlight-start']);

    run.turn(6); // 6 → 8
    run.turn(6); // 14 제1괄호 → 16
    expect(run.stage.calls.slice(-2)).toEqual(['event:1:FIRST_ENDING', 'jump:1:14>16:fx-spring-jump']);

    run.turn(2); // 18 코다 → 22
    expect(run.stage.calls.slice(-2)).toEqual(['event:1:CODA', 'jump:1:18>22:fx-coda-portal']);

    run.turn(3); // 25 D.S.S → 28 더블세뇨 → 35
    expect(run.stage.calls.filter((call) => call.startsWith('jump'))).toEqual([
      'jump:1:25>28:fx-hologram',
      'jump:1:28>35:fx-hologram',
    ]);
    expect(run.state.players[0].position).toBe(35);
  });

  it('도돌이표·달세뇨·더블코다도 무대 위치가 어긋나지 않는다', () => {
    const run = new Runner(2);
    run.turn(4); // P1 다카포 → 0
    run.turn(6); // P2 6 → 8
    run.turn(5); // P1 5
    run.turn(6); // P2 14 → 16
    run.turn(6); // P1 11
    run.turn(5); // P2 21 달세뇨 → 17
    expect(run.stage.calls).toContain('jump:2:21>17:fx-segno-fly');
    run.turn(4); // P1 15 끝 도돌이표 → 8
    expect(run.stage.calls).toContain('jump:1:15>8:fx-rewind');
    run.turn(1); // P2 18 코다 → 22
    run.turn(6); // P1 14 → 16
    run.turn(5); // P2 27 더블코다 → 36
    expect(run.stage.calls).toContain('jump:2:27>36:fx-wormhole');
    expect(run.state.players.map((player) => player.position)).toEqual([16, 36]);
  });

  it('페르마타는 얼리고, 쉬는 횟수가 줄 때마다 알린다', () => {
    const run = new Runner(1);
    run.turn(6); // 8
    run.turn(6); // 16
    run.turn(6); // 22
    run.turn(2); // 24
    run.turn(6); // 30 다중쉼표(4) → 34 페르마타
    expect(run.stage.calls).toContain('event:1:FERMATA');
    expect(run.stage.calls).toContain('frozen:1:2');
    expect(run.state.players[0].skipTurns).toBe(2);

    run.turn(1); // 쉬기
    expect(run.stage.calls).toEqual(['frozen:1:1']);
    run.turn(1); // 쉬기
    expect(run.stage.calls).toEqual(['frozen:1:0']);
    run.turn(3); // 다시 이동 37
    expect(run.state.players[0].position).toBe(37);
  });

  it('Fine에 도착하거나 한 바퀴를 돌면 우승 연출을 부른다', () => {
    const fine = new Runner(1);
    for (const dice of [6, 6, 6, 2, 6]) fine.turn(dice); // 34에서 얼음
    fine.turn(1);
    fine.turn(1);
    fine.turn(4); // 34 → 38 Fine
    expect(fine.stage.winner).toBe(1);
    expect(fine.stage.turn).toBeNull();
    expect(isAwaitingRoll(fine.state)).toBe(false);

    const lap = new Runner(1);
    for (const dice of [6, 6, 6, 2, 6]) lap.turn(dice);
    lap.turn(1);
    lap.turn(1);
    lap.turn(6); // 34 → 39 → 0 (한 바퀴)
    expect(lap.stage.winner).toBe(1);
    expect(lap.stage.calls).toContain('hop:1:0:final');
  });

  it('차례가 넘어갈 때마다 무대 위치를 상태와 한 번 더 맞춘다', () => {
    const run = new Runner(2);
    const before = run.stage.syncs;
    run.turn(5);
    expect(run.stage.syncs).toBe(before + 1);
    expect(run.stage.turn).toBe(2);
  });

  it('리셋하면 무대도 처음으로 돌아간다', () => {
    const run = new Runner(2);
    run.turn(5);
    run.stage.calls = [];
    run.dispatch({ type: 'RESET_GAME' });
    expect(run.stage.calls).toEqual(['reset:2']);
    expect(run.stage.turn).toBe(1);
  });

  it('진행 중인 게임에 무대가 뒤늦게 붙어도(2D → 3D 전환) 현재 상태를 그대로 놓는다', () => {
    const run = new Runner(1);
    for (const dice of [6, 6, 6, 2, 6]) run.turn(dice);
    const late = new FakeStage();
    syncStage(late, null, run.state);
    expect(late.positions.get(1)).toBe(34);
    expect(late.frozen.get(1)).toBe(2);
  });
});

describe('연출 시간표', () => {
  it('규칙에 나오는 모든 효과에 연출 시간이 정해져 있다', () => {
    const classes = new Set<string>();
    const jumps = new Set<string>();
    for (const cell of BOARD) {
      const event = resolveCellEvent(BOARD, cell.index);
      if (event.type === 'NONE') continue;
      classes.add(event.animationClass);
      if (event.type === 'JUMP_TO_INDEX') jumps.add(event.animationClass);
    }
    expect(classes.size).toBeGreaterThan(5);
    for (const cls of classes) expect(eventShowMs(cls)).toBeGreaterThanOrEqual(1000);
    for (const cls of jumps) expect(jumpTravelMs(cls)).toBeGreaterThanOrEqual(800);
  });
});
