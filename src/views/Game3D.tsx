// 3D 무대 화면. 게임 상태(state)는 App이 들고 있고, 여기서는 그 상태를 무대 연출과 HUD로 보여준다.
import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject } from 'react';
import { sound } from '../audio/sound';
import { BOARD } from '../data/boardCells';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/types';
import { LearningCard3D } from '../hud/LearningCard3D';
import { DiceCallout, EventBanner, LogToast, TurnFlag } from '../hud/Overlays';
import { SetupPanel, WinnerPanel } from '../hud/Panels';
import { PlayerChips } from '../hud/PlayerChips';
import { RollButton } from '../hud/RollButton';
import { TileInfo, destinationOf, hasTileInfo } from '../hud/TileInfo';
import { TopBar } from '../hud/TopBar';
import { Stage, type Cue, type ViewMode } from '../three/Stage';
import type { Insets } from '../three/camera';
import { isAwaitingRoll, syncStage } from '../three/stageSync';
import { waitForDisplayFont } from '../three/textures';
import { prefersReducedMotion } from '../three/timing';
import '../styles/hud3d.css';

export type RollHandler = (value: number, durationMs: number) => void;

interface Game3DProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  musicOn: boolean;
  onToggleMusic: () => void;
  onSwitch2D: () => void;
  /** 무대를 만들 수 없을 때(WebGL 오류 등) */
  onFail: () => void;
  /** 게임 루프가 주사위 눈을 정했을 때 부를 함수를 여기에 걸어 둔다 */
  rollHandler: MutableRefObject<RollHandler | null>;
}

function playCue(cue: Cue, value?: number): void {
  switch (cue) {
    case 'step':
      sound.step(value ?? 1);
      break;
    case 'step-down':
      sound.stepDown(value ?? 0);
      break;
    case 'dice-throw':
      sound.diceThrow();
      break;
    case 'dice-bounce':
      sound.diceBounce(value ?? 1);
      break;
    case 'dice-settle':
      sound.diceSettle(value ?? 1);
      break;
    case 'arrive':
      sound.arrive();
      break;
    case 'event':
      sound.event();
      break;
    case 'portal-in':
      sound.portalIn();
      break;
    case 'portal-out':
      sound.portalOut();
      break;
    case 'whoosh':
      sound.whoosh();
      break;
    case 'freeze':
      sound.freeze();
      break;
    case 'crack':
      sound.crack();
      break;
    case 'shatter':
      sound.shatter();
      break;
    case 'rocket':
      sound.rocket();
      break;
    case 'spring':
      sound.spring();
      break;
    case 'rewind':
      sound.rewind();
      break;
    case 'teleport':
      sound.teleport();
      break;
    case 'spotlight':
      sound.spotlight();
      break;
    case 'firework':
      sound.firework();
      break;
    case 'fanfare':
      sound.fanfare();
      break;
    default:
      break;
  }
}

/** HUD가 차지하는 가장자리. 무대는 이 안쪽에 판이 다 보이도록 카메라를 맞춘다 */
function insetsFor(width: number, height: number, setupOpen: boolean): Insets {
  const portrait = height > width * 1.05;
  if (setupOpen) {
    return portrait
      ? { top: 28, right: 8, bottom: Math.min(400, height * 0.5), left: 8 }
      : { top: 28, right: Math.min(420, width * 0.36), bottom: 28, left: 24 };
  }
  if (portrait) return { top: 132, right: 6, bottom: 176, left: 6 };
  // 가로로 눕힌 휴대폰처럼 높이가 낮으면 굴리기 버튼이 오른쪽 아래 구석으로 간다
  if (height < 520) return { top: 62, right: 118, bottom: 12, left: 12 };
  return { top: 76, right: 20, bottom: 124, left: 20 };
}

export default function Game3D({ state, dispatch, musicOn, onToggleMusic, onSwitch2D, onFail, rollHandler }: Game3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const syncedRef = useRef<GameState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const sizeRef = useRef({ width: 0, height: 0 });
  const powerRef = useRef(0.55);

  const [ready, setReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    window.innerHeight > window.innerWidth * 1.05 ? 'follow' : 'overview',
  );
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const [tileInfo, setTileInfo] = useState<number | null>(null);
  const [winnerShown, setWinnerShown] = useState(false);

  const canRoll = ready && isAwaitingRoll(state);
  const winner = state.players.find((player) => player.id === state.winnerId) ?? null;
  const current = state.players[state.currentPlayer];

  const measure = useCallback((forceSnap = false) => {
    const el = containerRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    const sizeChanged = width !== sizeRef.current.width || height !== sizeRef.current.height;
    sizeRef.current = { width, height };
    stage.resize(width, height, insetsFor(width, height, stateRef.current.setupOpen), forceSnap || sizeChanged);
  }, []);

  const roll = useCallback(
    (power: number) => {
      sound.unlock();
      sound.startMusic();
      powerRef.current = power;
      setTileInfo(null);
      stageRef.current?.showRoute(null);
      dispatch({ type: 'ROLL_DICE_START' });
    },
    [dispatch],
  );

  // 무대에서 올라오는 조작(칸·주사위 탭)은 항상 최신 상태를 보도록 ref를 거친다
  const handlers = useRef({
    tile: (_index: number | null): void => undefined,
    dice: (): void => undefined,
  });
  handlers.current.tile = (index) => {
    const stage = stageRef.current;
    if (!stage) return;
    if (index === null || !hasTileInfo(index)) {
      setTileInfo(null);
      stage.showRoute(null);
      return;
    }
    sound.unlock();
    sound.tap();
    setTileInfo(index);
    stage.pulseTile(index);
    const destination = destinationOf(index);
    if (destination !== null) stage.showRoute(index, destination);
    else stage.showRoute(null);
  };
  handlers.current.dice = () => {
    if (ready && isAwaitingRoll(stateRef.current)) roll(0.55);
  };

  // 무대 만들기
  useEffect(() => {
    let cancelled = false;
    let stage: Stage | null = null;

    const boot = async (): Promise<void> => {
      // 타일 이름표를 캔버스에 그리기 전에 글꼴이 준비되기를 기다린다
      await waitForDisplayFont();
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      try {
        stage = new Stage(canvas, BOARD, {
          onTileTap: (index) => handlers.current.tile(index),
          onDiceTap: () => handlers.current.dice(),
          onCue: playCue,
        });
      } catch (error) {
        console.error('3D 무대를 만들지 못했어요.', error);
        onFail();
        return;
      }
      stageRef.current = stage;
      if (import.meta.env.DEV) (window as unknown as { __stage?: Stage }).__stage = stage;
      // 화질은 기기 성능에 맞춰 자동으로 조절된다. 주소 끝에 ?quality=high 또는 ?quality=low를 붙이면 고정된다.
      const quality = new URLSearchParams(window.location.search).get('quality');
      if (quality === 'high') stage.setQuality(3, true);
      if (quality === 'low') stage.setQuality(0, true);
      stage.setReducedMotion(prefersReducedMotion());
      stage.setViewMode(viewModeRef.current);
      sizeRef.current = { width: 0, height: 0 };
      measure(true);
      syncStage(stage, null, stateRef.current);
      syncedRef.current = stateRef.current;
      setReady(true);
    };
    void boot();

    return () => {
      cancelled = true;
      stage?.dispose();
      stageRef.current = null;
      syncedRef.current = null;
      setReady(false);
    };
    // 무대는 화면에 한 번만 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면 크기 변화
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  // 시작 화면 ↔ 게임 화면에서 HUD 영역이 달라진다
  useEffect(() => {
    measure();
  }, [measure, state.setupOpen, ready]);

  // 게임 상태 → 무대 명령
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !ready) return;
    syncStage(stage, syncedRef.current, state);
    syncedRef.current = state;
  }, [state, ready]);

  // 주사위 눈이 정해지면 무대의 주사위를 그 눈으로 굴린다
  useEffect(() => {
    rollHandler.current = (value, durationMs) => {
      stageRef.current?.rollDice(value, durationMs, powerRef.current);
    };
    return () => {
      rollHandler.current = null;
    };
  }, [rollHandler]);

  useEffect(() => {
    stageRef.current?.setViewMode(viewMode);
  }, [viewMode, ready]);

  // 연출이 시작되면 칸 도감은 닫는다
  useEffect(() => {
    if (state.activeEvent || state.setupOpen || state.phase === 'ROLLING') setTileInfo(null);
  }, [state.activeEvent, state.setupOpen, state.phase]);

  // 우승 화면은 불꽃놀이를 잠깐 본 뒤, 학습 카드를 닫고 나서 띄운다
  useEffect(() => {
    if (state.winnerId === null) {
      setWinnerShown(false);
      return undefined;
    }
    const timeout = window.setTimeout(() => setWinnerShown(true), 1500);
    return () => window.clearTimeout(timeout);
  }, [state.winnerId]);

  const learningOpen = state.learningQueue.length > 0;
  useEffect(() => {
    if (learningOpen) sound.card();
  }, [learningOpen]);

  // 여럿이 할 때 차례가 넘어가면 알림음
  const turnOwner = current?.id;
  useEffect(() => {
    if (canRoll && stateRef.current.players.length > 1) sound.turn();
  }, [canRoll, turnOwner]);

  const startGame = (): void => {
    sound.unlock();
    sound.startMusic();
    dispatch({ type: 'START_GAME', count: state.selectedPlayerCount });
  };

  const showWinner = winner !== null && winnerShown && !learningOpen;
  // 학습 카드는 연출이 한창일 때(우승 직후)에는 잠깐 미뤘다 띄운다
  const showLearning = learningOpen && (state.winnerId === null || winnerShown);

  return (
    <div
      ref={containerRef}
      className="g3-root"
      data-setup={state.setupOpen ? 'true' : 'false'}
      data-event={state.activeEvent ? 'true' : 'false'}
      onPointerDown={() => sound.unlock()}
    >
      <canvas ref={canvasRef} className="g3-canvas" aria-label="반복기호의 마블 3D 보드" role="img" />
      <div className="g3-vignette" aria-hidden="true" />

      {!ready ? (
        <div className="g3-loading" role="status">
          <span className="g3-loading-note" aria-hidden="true" />
          무대를 준비하는 중
        </div>
      ) : null}

      {ready && state.setupOpen ? (
        <SetupPanel
          selected={state.selectedPlayerCount}
          onSelect={(count) => {
            sound.unlock();
            sound.tap();
            dispatch({ type: 'SET_PLAYER_COUNT', count });
          }}
          onStart={startGame}
          onSwitch2D={onSwitch2D}
        />
      ) : null}

      {ready && !state.setupOpen ? (
        <>
          <TopBar
            turnCount={state.turnCount}
            soundOn={state.soundEnabled}
            musicOn={musicOn}
            viewMode={viewMode}
            onToggleSound={() => dispatch({ type: 'TOGGLE_SOUND' })}
            onToggleMusic={onToggleMusic}
            onToggleView={() => {
              stageRef.current?.resetView();
              setViewMode((mode) => (mode === 'follow' ? 'overview' : 'follow'));
            }}
            onSwitch2D={onSwitch2D}
            onReset={() => dispatch({ type: 'RESET_GAME' })}
          >
            <PlayerChips state={state} />
          </TopBar>

          <EventBanner event={state.activeEvent} />
          <DiceCallout value={state.phase === 'MOVING' || state.phase === 'RESOLVING_EVENT' ? state.diceValue : null} turnKey={state.turnCount} />
          <TurnFlag player={current} active={canRoll && state.players.length > 1} />

          {tileInfo !== null ? (
            <TileInfo
              index={tileInfo}
              onClose={() => {
                setTileInfo(null);
                stageRef.current?.showRoute(null);
              }}
            />
          ) : null}

          {winner === null ? (
            <div className="g3-bottom">
              <LogToast logs={state.eventLog} />
              <RollButton state={state} canRoll={canRoll} onRoll={roll} />
            </div>
          ) : null}

          {showLearning ? (
            <LearningCard3D
              events={state.learningQueue}
              onClose={() => dispatch({ type: 'CLOSE_LEARNING' })}
              onFlip={() => sound.card()}
            />
          ) : null}

          {showWinner && winner ? <WinnerPanel winner={winner} onRestart={() => dispatch({ type: 'RESET_GAME' })} /> : null}
        </>
      ) : null}
    </div>
  );
}
