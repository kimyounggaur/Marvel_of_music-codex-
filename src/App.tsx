import { Component, Suspense, lazy, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { sound } from './audio/sound';
import { gameReducer, initialGameState } from './game/reducer';
import { useGameLoop } from './hooks/useGameLoop';
import { ClassicGame } from './views/ClassicGame';
import type { RollHandler } from './views/Game3D';

// 3D 무대(three.js)는 따로 묶어서 필요할 때만 내려받는다. 2D만 쓰는 기기는 이 묶음을 받지 않는다.
const Game3D = lazy(() => import('./views/Game3D'));

type View = '3d' | '2d';

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/** 3D 화면에서 예기치 못한 오류가 나면 2D 화면으로 내려보낸다 */
class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('3D 화면 오류', error);
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

function StageLoading() {
  return (
    <div className="stage-loading" role="status">
      무대를 준비하는 중
    </div>
  );
}

function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [webgl] = useState(supportsWebGL);
  const [view, setView] = useState<View>(() => (webgl ? '3d' : '2d'));
  const [notice, setNotice] = useState<string | null>(() =>
    webgl ? null : '이 기기에서는 3D를 쓸 수 없어 2D 판으로 보여드려요.',
  );
  const [musicOn, setMusicOn] = useState(true);
  const rollHandler = useRef<RollHandler | null>(null);

  useGameLoop(state, dispatch, {
    cinematic: view === '3d',
    onRoll: (value, durationMs) => rollHandler.current?.(value, durationMs),
  });

  // 소리 설정을 엔진에 반영한다. 2D 화면의 소리 버튼 하나는 효과음과 배경음을 함께 끈다.
  useEffect(() => {
    sound.setSfx(state.soundEnabled);
    sound.setMusic(view === '3d' ? musicOn : musicOn && state.soundEnabled);
  }, [musicOn, state.soundEnabled, view]);

  const fallbackTo2D = (): void => {
    setNotice('3D 화면을 열 수 없어 2D 판으로 바꿨어요.');
    setView('2d');
  };

  if (view === '3d') {
    return (
      <StageBoundary onError={fallbackTo2D}>
        <Suspense fallback={<StageLoading />}>
          <Game3D
            state={state}
            dispatch={dispatch}
            musicOn={musicOn}
            onToggleMusic={() => setMusicOn((on) => !on)}
            onSwitch2D={() => {
              setNotice(null);
              setView('2d');
            }}
            onFail={fallbackTo2D}
            rollHandler={rollHandler}
          />
        </Suspense>
      </StageBoundary>
    );
  }

  return (
    <ClassicGame
      state={state}
      dispatch={dispatch}
      notice={notice}
      onSwitch3D={
        webgl
          ? () => {
              setNotice(null);
              setView('3d');
            }
          : undefined
      }
    />
  );
}

export default App;
