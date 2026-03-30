export function LogoSvg({ size = 32, id = "logo-grad" }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
        stroke={`url(#${id})`}
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M16 8L22 11.5V18.5L16 22L10 18.5V11.5L16 8Z"
        fill={`url(#${id})`}
      />
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="28" y2="30">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}
