export default function Logo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <path
        d="M10 12.5C10 10 13 8.5 16 8.5C19.5 8.5 22 10 22 12.5C22 16 10 14.5 10 19.5C10 22 13 23.5 16 23.5C19 23.5 22 22 22 19.5"
        stroke="white" strokeWidth="3" strokeLinecap="round"
      />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="rgb(var(--primary-600))" />
          <stop offset="1" stopColor="rgb(var(--primary-400))" />
        </linearGradient>
      </defs>
    </svg>
  );
}
