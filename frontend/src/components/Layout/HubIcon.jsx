/**
 * SWIGS Hub icon — 4 rounded squares in a 2×2 grid.
 * Uses currentColor so it inherits the app's accent color.
 */
export default function HubIcon({ size = 16, className = '' }) {
  const gap = 1.5;
  const r = 2.5;
  const half = (24 - gap) / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <rect x="0" y="0" width={half} height={half} rx={r} />
      <rect x={half + gap} y="0" width={half} height={half} rx={r} />
      <rect x="0" y={half + gap} width={half} height={half} rx={r} />
      <rect x={half + gap} y={half + gap} width={half} height={half} rx={r} />
    </svg>
  );
}
