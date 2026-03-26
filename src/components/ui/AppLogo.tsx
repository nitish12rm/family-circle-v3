interface AppLogoProps {
  size?: number;        // icon SVG size
  containerSize?: number; // outer box size (0 = no container)
  className?: string;
}

/**
 * The Family Circle logo — three nodes (parent + two children) connected.
 * Used in TopBar, PWAInstallBanner, AuthForm, etc.
 */
export default function AppLogo({ size = 32, containerSize = 0, className = "" }: AppLogoProps) {
  const svg = (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="10" r="5" fill="#7C5CFC" />
      <circle cx="7" cy="22" r="4" fill="#7C5CFC" opacity="0.7" />
      <circle cx="25" cy="22" r="4" fill="#7C5CFC" opacity="0.7" />
      <line x1="16" y1="15" x2="7" y2="18" stroke="#7C5CFC" strokeWidth="1.5" opacity="0.5" />
      <line x1="16" y1="15" x2="25" y2="18" stroke="#7C5CFC" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );

  if (!containerSize) return svg;

  return (
    <div
      className={`bg-accent-muted border border-accent/30 rounded-2xl flex items-center justify-center shrink-0 shadow-glow ${className}`}
      style={{ width: containerSize, height: containerSize }}
    >
      {svg}
    </div>
  );
}
