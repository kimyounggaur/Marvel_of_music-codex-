import { useMemo, useReducer } from 'react';
import { Board } from './components/Board';
import { DicePanel } from './components/DicePanel';
import { EventLog } from './components/EventLog';
import { EventOverlay } from './components/EventOverlay';
import { LearningCard } from './components/LearningCard';
import { PlayerStatusBar } from './components/PlayerStatusBar';
import { BOARD } from './data/boardCells';
import { gameReducer, initialGameState } from './game/reducer';
import { useGameLoop } from './hooks/useGameLoop';

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  useGameLoop(state, dispatch);

  const canRoll =
    !state.setupOpen &&
    state.phase === 'READY' &&
    state.learningQueue.length === 0 &&
    state.winnerId === null;
  const winner = useMemo(
    () => state.players.find((player) => player.id === state.winnerId) ?? null,
    [state.players, state.winnerId],
  );

  return (
    <main className="app-shell">
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

export default App;
