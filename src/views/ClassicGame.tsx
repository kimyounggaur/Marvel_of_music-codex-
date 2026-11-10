// 기존 2D 보드 화면. WebGL을 쓸 수 없는 기기에서 자동으로 쓰이고, 3D 화면에서 직접 전환할 수도 있다.
import { useMemo, type Dispatch } from 'react';
import { Box } from 'lucide-react';
import { sound } from '../audio/sound';
import { Board } from '../components/Board';
import { DicePanel } from '../components/DicePanel';
import { EventLog } from '../components/EventLog';
import { EventOverlay } from '../components/EventOverlay';
import { LearningCard } from '../components/LearningCard';
import { PlayerStatusBar } from '../components/PlayerStatusBar';
import { BOARD } from '../data/boardCells';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/types';

interface ClassicGameProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  /** 3D 화면으로 돌아갈 수 있으면 전달된다 */
  onSwitch3D?: () => void;
  /** 3D를 쓸 수 없어 2D로 내려온 경우의 안내 */
  notice?: string | null;
}

export function ClassicGame({ state, dispatch, onSwitch3D, notice }: ClassicGameProps) {
  const canRoll =
    !state.setupOpen && state.phase === 'READY' && state.learningQueue.length === 0 && state.winnerId === null;
  const winner = useMemo(
    () => state.players.find((player) => player.id === state.winnerId) ?? null,
    [state.players, state.winnerId],
  );

  return (
    <main className="app-shell" onPointerDown={() => sound.unlock()}>
      {notice ? (
        <p className="view-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="game-layout" aria-label="반복기호의 마블 게임">
        <div className="board-column">
          <Board
            cells={BOARD}
            players={state.setupOpen ? [] : state.players}
            currentPlayerId={state.players[state.currentPlayer]?.id ?? 1}
            phase={state.phase}
            activeEvent={state.activeEvent}
            movementTick={state.movementTick}
          />
        </div>

        <aside className="control-column" aria-label="게임 조작 패널">
          {state.setupOpen ? (
            <section className="setup-panel" aria-label="플레이어 선택">
              <p className="eyebrow">음악의 마블</p>
              <h1>반복기호의 마블</h1>
              <div className="player-count-grid" role="group" aria-label="플레이어 수">
                {[1, 2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={state.selectedPlayerCount === count ? 'count-button selected' : 'count-button'}
                    onClick={() => dispatch({ type: 'SET_PLAYER_COUNT', count })}
                    aria-pressed={state.selectedPlayerCount === count}
                  >
                    {count}명
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="primary-action"
                onClick={() => dispatch({ type: 'START_GAME', count: state.selectedPlayerCount })}
                aria-label="선택한 인원으로 게임 시작"
              >
                게임 시작
              </button>
            </section>
          ) : (
            <>
              <PlayerStatusBar state={state} />
              <DicePanel state={state} dispatch={dispatch} canRoll={canRoll} />
              <EventLog logs={state.eventLog} />
            </>
          )}
          {onSwitch3D ? (
            <button type="button" className="view-switch" onClick={onSwitch3D}>
              <Box size={18} aria-hidden="true" />
              3D 무대로 보기
            </button>
          ) : null}
        </aside>
      </section>

      {winner ? (
        <section className="winner-banner" aria-live="polite">
          <strong>{winner.name} 우승!</strong>
          <span>반복기호 여행을 완성했어요.</span>
        </section>
      ) : null}

      <EventOverlay event={state.activeEvent} />
      <LearningCard events={state.learningQueue} onClose={() => dispatch({ type: 'CLOSE_LEARNING' })} />
    </main>
  );
}
