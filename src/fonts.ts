// 화면 글꼴: 주아체(배달의민족 주아, SIL Open Font License 1.1).
// 실물 보드판의 둥근 글씨와 같은 계열이라 HUD와 타일 이름표에 함께 쓴다.
// 한글 2,350자와 영문·숫자가 한 파일에 들어 있어 파일 하나만 받으면 된다.
import juaUrl from '@fontsource/jua/files/jua-korean-400-normal.woff2?url';

let loading: Promise<void> | null = null;

/** 글꼴을 내려받아 등록한다. 여러 번 불러도 한 번만 받는다. 실패하면 시스템 글꼴로 보인다. */
export function loadDisplayFont(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
    try {
      const face = new FontFace('Jua', `url("${juaUrl}") format("woff2")`, {
        style: 'normal',
        weight: '400',
        display: 'swap',
      });
      document.fonts.add(face);
      await face.load();
    } catch {
      // 글꼴 없이도 게임은 진행한다
    }
  })();
  return loading;
}
