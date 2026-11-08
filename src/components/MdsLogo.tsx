type MdsLogoProps = {
  size?: number
  tone?: 'dark' | 'light'
  decorative?: boolean
  className?: string
}

export default function MdsLogo({
  size = 32,
  tone = 'dark',
  decorative = false,
  className,
}: MdsLogoProps) {
  const colors = tone === 'dark'
    ? { primary: '#f5c518', secondary: '#65c7f7', surface: '#0c2439', node: '#ffffff' }
    : { primary: '#102a43', secondary: '#1677c8', surface: '#ffffff', node: '#f5c518' }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'Mobility Data Space'}
    >
      {!decorative && <title>Mobility Data Space</title>}

      {/* The primary lane forms an M: provider, exchange, and consumer. */}
      <path
        d="M8 49 L19.5 15.5 L32 37.5 L44.5 15.5 L56 49"
        stroke={colors.primary}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* A counter-flowing lane makes the mark an interchange rather than a static monogram. */}
      <path
        d="M8 15 L21 49 L32 28 L43 49 L56 15"
        stroke={colors.secondary}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Protected exchange node: data meets without losing its source identity. */}
      <circle cx="32" cy="32.5" r="8.5" fill={colors.surface} stroke={colors.primary} strokeWidth="2.5" />
      <rect x="28.5" y="29" width="7" height="7" rx="1.7" fill={colors.node} transform="rotate(45 32 32.5)" />

      <circle cx="8" cy="49" r="3" fill={colors.primary} />
      <circle cx="56" cy="49" r="3" fill={colors.primary} />
      <circle cx="8" cy="15" r="2.5" fill={colors.secondary} />
      <circle cx="56" cy="15" r="2.5" fill={colors.secondary} />
    </svg>
  )
}
