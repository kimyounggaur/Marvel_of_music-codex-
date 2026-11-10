// 음악기호를 화면(HUD)에 그리는 아이콘.
// 기기에 음악기호 글꼴이 없어도 깨지지 않도록 유니코드 문자 대신 프로젝트의 기호 그림과 SVG를 쓴다.
import { getCellAsset } from '../data/symbolAssets';
import type { CellKind } from '../game/types';

interface SymbolIconProps {
  kind: CellKind;
  /** 다중쉼표의 마디 수 */
  count?: number;
  className?: string;
}

const TEXT_SYMBOLS: Partial<Record<CellKind, string>> = {
  DA_CAPO: 'D.C.',
  DAL_SEGNO: 'D.S.',
  DOUBLE_SEGNO_TRIGGER: 'D.S.S',
  FINE: 'Fine',
  START: 'Start!',
};

function asset(kind: CellKind): string | null {
  return getCellAsset({ index: 0, kind, label: '', side: 'top' });
}

export function SymbolIcon({ kind, count, className }: SymbolIconProps) {
  const classes = ['g3-symbol', className].filter(Boolean).join(' ');

  if (kind === 'MULTI_REST') {
    // 굵은 가로 막대 + 양 끝 세로줄 + 위에 쉬는 마디 수
    return (
      <span className={classes} aria-hidden="true">
        <svg viewBox="0 0 120 96" role="presentation">
          <text x="60" y="38" textAnchor="middle" className="g3-symbol-number">
            {count ?? ''}
          </text>
          <rect x="18" y="58" width="84" height="14" rx="2" fill="currentColor" />
          <rect x="12" y="46" width="6" height="38" rx="2" fill="currentColor" />
          <rect x="102" y="46" width="6" height="38" rx="2" fill="currentColor" />
        </svg>
      </span>
    );
  }

  if (kind === 'FIRST_ENDING' || kind === 'SECOND_ENDING') {
    // 꺾인 괄호선 아래에 번호
    return (
      <span className={classes} aria-hidden="true">
        <svg viewBox="0 0 120 96" role="presentation">
          <path d="M16 66V24h92" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="square" />
          <text x="30" y="72" className="g3-symbol-number">
            {kind === 'FIRST_ENDING' ? '1.' : '2.'}
          </text>
        </svg>
      </span>
    );
  }

  const text = TEXT_SYMBOLS[kind];
  if (text) {
    return (
      <span className={`${classes} g3-symbol-text`} aria-hidden="true">
        {text}
      </span>
    );
  }

  const twin = kind === 'DOUBLE_SEGNO' || kind === 'DOUBLE_CODA';
  const src = kind === 'DOUBLE_SEGNO' ? asset('SEGNO') : kind === 'DOUBLE_CODA' ? asset('CODA') : asset(kind);
  if (!src) return null;

  return (
    <span className={`${classes}${twin ? ' g3-symbol-twin' : ''}`} aria-hidden="true">
      <img src={src} alt="" draggable={false} />
      {twin ? <img src={src} alt="" draggable={false} /> : null}
    </span>
  );
}
