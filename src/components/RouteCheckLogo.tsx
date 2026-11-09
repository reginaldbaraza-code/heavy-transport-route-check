import { useId } from "react"

export type RouteCheckLogoProps = {
  size?: number
  tone?: "dark" | "light"
  decorative?: boolean
  className?: string
}

export type LogoDetail = "small" | "medium" | "full"

/**
 * Hand-authored 64×64 mark. Centreline stays in 14–52 (~12% tile margin
 * after a 5px round-cap stroke). Three G1 cubics form the S; two lines
 * form the check (round join at the corner, not G1).
 *
 * C1 end tangent (4,−6) = C2 start; C2 end (−4,−4) = C3 start.
 */
export const ROUTE_PATH =
  "M14 48 C24 48 32 44 36 38 C40 32 44 28 40 24 C36 20 38 17 42 17 L47 24 L52 13"

/** Bold simplified S+check for ≤24px. Two G1 cubics, then the check. */
export const ROUTE_PATH_SMALL =
  "M14 46 C24 46 30 42 34 36 C38 30 40 24 36 20 L42 26 L52 14"

/** Dashed white centre line along the S only (not the check). Full ≥64px. */
export const LANE_PATH = "M14 48 C24 48 32 44 36 38 C40 32 44 28 40 24"

const TITLE = "Heavy transport route check"
const STROKE = { small: 7, medium: 5.5, full: 5 } as const

export function logoDetailForSize(size: number): LogoDetail {
  if (size <= 24) return "small"
  if (size < 64) return "medium"
  return "full"
}

export default function RouteCheckLogo({
  size = 32,
  tone = "dark",
  decorative = false,
  className,
}: RouteCheckLogoProps) {
  const uid = useId().replace(/:/g, "")
  const detail = logoDetailForSize(size)
  const tile = `rc-tile-${uid}`
  const route = `rc-route-${uid}`
  const routePath = detail === "small" ? ROUTE_PATH_SMALL : ROUTE_PATH
  const stroke = STROKE[detail]
  const showLane = detail === "full"

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      shapeRendering="geometricPrecision"
      data-tone={tone}
      data-detail={detail}
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
          x1="14"
          y1="48"
          x2="52"
          y2="13"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F5C518" />
          <stop offset="1" stopColor="#F0A500" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${tile})`} />
      <path
        d={routePath}
        stroke={`url(#${route})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLane && (
        <path
          d={LANE_PATH}
          stroke="#FFFFFF"
          strokeOpacity="0.88"
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2.5 3"
        />
      )}
    </svg>
  )
}
