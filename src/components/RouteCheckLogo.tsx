import { useId } from "react"

export type RouteCheckLogoProps = {
  size?: number
  tone?: "dark" | "light"
  decorative?: boolean
  className?: string
}

/** Amber route: left-edge entry, S-curve, then a check (short down, long up). */
export const ROUTE_PATH =
  "M-2 51.8 C14 51.8 20 51.5 26 48.4 C35.2 43.8 43.2 40.4 40.2 33.8 C37.4 27.8 33 26.2 31.5 22.8 C30 19 34.2 15.4 39.8 13.35 L46.5 19.7 L56.75 10.05"

/** Inner (left) dashed lane — lower/middle S only. */
export const LANE_INNER_PATH = "M19.2 43.6 C24.8 42 28.6 37.4 29.6 30.6"

/** Outer (right) dashed lane — lower/middle S only. */
export const LANE_OUTER_PATH = "M33 54.4 C40.6 49.6 44.8 43.2 42.6 36.8"

const TITLE = "Heavy Transport Route Check"

export default function RouteCheckLogo({
  size = 32,
  tone = "dark",
  decorative = false,
  className,
}: RouteCheckLogoProps) {
  const uid = useId().replace(/:/g, "")
  const showGlow = size >= 24
  const tile = `rc-tile-${uid}`
  const route = `rc-route-${uid}`
  const clip = `rc-clip-${uid}`
  const glow = `rc-glow-${uid}`

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      data-tone={tone}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : TITLE}
    >
      {!decorative && <title>{TITLE}</title>}
      <defs>
        <linearGradient
          id={tile}
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#13294B" />
          <stop offset="1" stopColor="#0A1A33" />
        </linearGradient>
        <linearGradient
          id={route}
          x1="0"
          y1="52"
          x2="56"
          y2="10"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F5C518" />
          <stop offset="1" stopColor="#F0A500" />
        </linearGradient>
        <clipPath id={clip}>
          <rect width="64" height="64" rx="14" />
        </clipPath>
        {showGlow && (
          <filter
            id={glow}
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        )}
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" rx="14" fill={`url(#${tile})`} />
        {showGlow && (
          <path
            d={ROUTE_PATH}
            stroke="#F5C518"
            strokeWidth="6.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.28"
            filter={`url(#${glow})`}
          />
        )}
        <path
          d={LANE_INNER_PATH}
          stroke="#FFFFFF"
          strokeOpacity="0.7"
          strokeWidth="1.12"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2.4 2.75"
        />
        <path
          d={LANE_OUTER_PATH}
          stroke="#FFFFFF"
          strokeOpacity="0.7"
          strokeWidth="1.12"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2.4 2.75"
        />
        <path
          d={ROUTE_PATH}
          stroke={`url(#${route})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
