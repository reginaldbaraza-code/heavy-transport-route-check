import { useId } from "react"

export type RouteCheckLogoProps = {
  size?: number
  tone?: "dark" | "light"
  decorative?: boolean
  className?: string
}

export type LogoDetail = "small" | "medium" | "full"

/** Amber route: left-edge entry, S-curve, then a check (short down, long up). */
export const ROUTE_PATH =
  "M2 50 C16 50 22 49.5 28 46 C36.5 41.5 44 38 41.5 32 C38.5 26.5 34 25 32.5 21.5 C31 18 35 14.5 40.5 13 L47 19.5 L57.5 10"

/** Pixel-snapped 16/24px mark — integer coords on the 64 viewBox (multiples of 4). */
export const ROUTE_PATH_SMALL =
  "M4 48 C16 48 24 48 28 44 C36 40 44 40 40 32 C36 28 32 24 32 20 C32 16 36 12 40 12 L48 20 L60 8"

/** Inner (left) dashed lane — lower/middle S only. */
export const LANE_INNER_PATH = "M20 42 C26 40 30 36 31 29"

/** Outer (right) dashed lane — lower/middle S only. */
export const LANE_OUTER_PATH = "M34 52 C42 47 46 41 44 35"

const TITLE = "Heavy transport route check"

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
  const clip = `rc-clip-${uid}`
  const routePath = detail === "small" ? ROUTE_PATH_SMALL : ROUTE_PATH
  const stroke = detail === "small" ? 6.5 : detail === "medium" ? 5.5 : 5
  const showLanes = detail === "full" || (detail === "medium" && size >= 32)
  const showGlowStroke = detail === "full"

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
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" rx="14" fill={`url(#${tile})`} />
        {showGlowStroke && (
          <path
            d={routePath}
            stroke="#F5C518"
            strokeWidth={stroke + 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.22"
          />
        )}
        {showLanes && (
          <>
            <path
              d={LANE_INNER_PATH}
              stroke="#FFFFFF"
              strokeOpacity="0.7"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2.4 2.75"
            />
            <path
              d={LANE_OUTER_PATH}
              stroke="#FFFFFF"
              strokeOpacity="0.7"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2.4 2.75"
            />
          </>
        )}
        <path
          d={routePath}
          stroke={`url(#${route})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
