// 3D 글자(보드 중앙 제목, D.C./Fine 같은 기호 조형물)에 쓰는 글리프 외곽선을 뽑아
// three.js Font 형식(JSON)으로 저장한다.
//
//   node scripts/make-title-glyphs.mjs
//
// 글꼴: Jua (배달의민족 주아) — SIL Open Font License 1.1 (@fontsource/jua 패키지 동봉 LICENSE 참고)
// 3D로 세울 글자를 바꾸고 싶으면 아래 HANGUL 문자열에 글자를 추가한 뒤 다시 실행한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = path.join(root, 'node_modules/@fontsource/jua/files');

// 조형물에 쓰는 글자만 담는다: 숫자(다중쉼표·괄호), D.C. / D.S. / D.S.S / Fine / Start!
const ASCII = '0123456789.!DCSFinetar';
const HANGUL = '반복기호의마블';

function load(file) {
  const buf = readFileSync(path.join(fontDir, file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const RESOLUTION = 1000;

function glyphToken(font, char) {
  const glyph = font.charToGlyph(char);
  if (!glyph || glyph.index === 0) return null;
  const scale = RESOLUTION / font.unitsPerEm;
  const r = (n) => Math.round(n * scale);
  let o = '';
  let cx = NaN;
  let cy = NaN;
  for (const cmd of glyph.path.commands) {
    if (cmd.type === 'Z') continue; // three의 ShapePath는 닫기 명령이 필요 없다
    const x = r(cmd.x);
    const y = r(cmd.y);
    // 길이 0인 직선은 돌출(bevel) 계산을 망가뜨리므로 버린다
    if (cmd.type === 'L' && x === cx && y === cy) continue;
    const type = cmd.type === 'C' ? 'b' : cmd.type.toLowerCase();
    o += `${type} ${x} ${y} `;
    if (cmd.x1 !== undefined) o += `${r(cmd.x1)} ${r(cmd.y1)} `;
    if (cmd.x2 !== undefined) o += `${r(cmd.x2)} ${r(cmd.y2)} `;
    cx = x;
    cy = y;
  }
  return { ha: r(glyph.advanceWidth), o: o.trim() };
}

const latin = load('jua-latin-400-normal.woff');
const korean = load('jua-korean-400-normal.woff');

const glyphs = {};
const missing = [];
for (const char of ASCII) {
  const token = glyphToken(latin, char) ?? glyphToken(korean, char);
  if (token) glyphs[char] = token;
  else missing.push(char);
}
for (const char of HANGUL) {
  const token = glyphToken(korean, char);
  if (token) glyphs[char] = token;
  else missing.push(char);
}

const scale = RESOLUTION / korean.unitsPerEm;
const data = {
  glyphs,
  familyName: 'Jua',
  license: 'SIL Open Font License 1.1 — Copyright 2018 The Jua Project Authors',
  ascender: Math.round(korean.ascender * scale),
  descender: Math.round(korean.descender * scale),
  underlinePosition: Math.round((korean.tables.post?.underlinePosition ?? -100) * scale),
  underlineThickness: Math.round((korean.tables.post?.underlineThickness ?? 50) * scale),
  boundingBox: {
    xMin: Math.round(korean.tables.head.xMin * scale),
    xMax: Math.round(korean.tables.head.xMax * scale),
    yMin: Math.round(korean.tables.head.yMin * scale),
    yMax: Math.round(korean.tables.head.yMax * scale),
  },
  resolution: RESOLUTION,
};

const out = path.join(root, 'src/three/assets/jua-glyphs.json');
writeFileSync(out, JSON.stringify(data));
console.log(`glyphs: ${Object.keys(glyphs).length}, missing: ${JSON.stringify(missing)}, bytes: ${JSON.stringify(data).length}`);
console.log('unitsPerEm', korean.unitsPerEm, latin.unitsPerEm, 'asc/desc', data.ascender, data.descender, 'bbox', JSON.stringify(data.boundingBox));
