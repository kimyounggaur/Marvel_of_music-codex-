// 파일 하나로 끝나는 3D 판 빌드: `npm run build:single` → dist-single/index.html
// 서버 없이 더블클릭으로 열거나 메신저·LMS에 그대로 올려 쓸 수 있다.
// 글꼴·기호 이미지·자바스크립트·스타일을 모두 이 파일 안에 넣는다.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const SYMBOL_DIR = fileURLToPath(new URL('./public/assets/symbols', import.meta.url));

/**
 * 기호 이미지는 public/ 에 있어서 주소로만 불러온다. 파일 하나짜리 빌드에서는 주소가 닿지 않으므로
 * symbolAssets.ts 가 이미지를 데이터 주소(data URI)로 돌려주게 바꾼다. 원본 소스는 건드리지 않는다.
 */
function inlineSymbolImages(): Plugin {
  return {
    name: 'inline-symbol-images',
    enforce: 'pre',
    transform(code, id) {
      if (!/src[\\/]data[\\/]symbolAssets\.ts$/.test(id)) return null;

      const assets: Record<string, string> = {};
      for (const name of readdirSync(SYMBOL_DIR)) {
        if (!name.endsWith('.png') || name === 'board-bg.png') continue; // 판 배경 그림은 어디서도 쓰지 않는다
        const base64 = readFileSync(`${SYMBOL_DIR}/${name}`).toString('base64');
        assets[`assets/symbols/${name}`] = `data:image/png;base64,${base64}`;
      }

      const original = /const withBase = [^\n]*\n/;
      if (!original.test(code)) throw new Error('symbolAssets.ts 의 withBase 를 찾지 못했어요. 파일 구조가 바뀌었나요?');
      const replaced = code.replace(
        original,
        `const INLINE_ASSETS: Record<string, string> = ${JSON.stringify(assets)};\n` +
          'const withBase = (path: string): string => INLINE_ASSETS[path] ?? `${import.meta.env.BASE_URL}${path}`;\n',
      );
      return { code: replaced, map: null };
    },
  };
}

/** 탭 아이콘도 파일 안에 넣어, 열 때 찾지 못하는 파일 요청이 없게 한다. */
function inlineFavicon(): Plugin {
  return {
    name: 'inline-favicon',
    transformIndexHtml(html) {
      const svg = readFileSync(fileURLToPath(new URL('./public/favicon.svg', import.meta.url)));
      return html.replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${svg.toString('base64')}"`);
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false, // 이미지는 위 플러그인이 파일 안으로 넣는다. public/ 을 따로 복사하지 않는다.
  plugins: [react(), inlineSymbolImages(), inlineFavicon(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
  },
});
