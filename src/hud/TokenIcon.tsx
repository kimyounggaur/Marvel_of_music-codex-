// 플레이어 말(음표 캐릭터)의 작은 아이콘
interface TokenIconProps {
  color: string;
  size?: number;
}

export function TokenIcon({ color, size = 28 }: TokenIconProps) {
  return (
    <svg className="g3-token-icon" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M31 6v24" stroke={color} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M31 6c5 3 11 5 10 14-1-5-5-7-10-8z" fill={color} />
      <ellipse cx="20" cy="32" rx="13" ry="11" fill={color} />
      <ellipse cx="15.5" cy="28" rx="5" ry="3" fill="#ffffff" opacity="0.35" />
      <circle cx="15.5" cy="31.5" r="2.1" fill="#16223f" />
      <circle cx="24.5" cy="31.5" r="2.1" fill="#16223f" />
      <path d="M16.5 36.5c2.2 2 5 2 7 0" stroke="#16223f" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}
