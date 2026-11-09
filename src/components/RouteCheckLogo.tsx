import { useId } from "react"

export type RouteCheckLogoProps = {
  size?: number
  tone?: "dark" | "light"
  decorative?: boolean
  className?: string
}

export type LogoDetail = "small" | "medium" | "full"

/** Full/medium road. S-curve then check at upper right. */
export const ROUTE_PATH =
  "M7 52 C22 52 36.5 48 36.5 39.5 C36.5 33.5 28.2 30.5 28.2 24.5 C28.2 19.6 34 15.6 39.6 11.8 L47.6 20 L56.6 11"

/** Bold simplified S+check for ≤24px and favicon-32. */
export const ROUTE_PATH_SMALL =
  "M8 52 C22 52 36 48 36 40 C36 34 27.5 31 27.5 24.5 C27.5 19.5 33.5 15.5 39 12 L47 20.5 L56 11.5"

/** Dashed lane on the inner/left side of the S. Full ≥64px only. */
export const LANE_LEFT_PATH =
  "M18.5 46.4 C24.6 44.6 29.4 40.6 30 35.6 C30.2 33.8 29.6 32.4 28.8 31.2"

/** Dashed lane on the outer/right side of the S. Full ≥64px only. */
export const LANE_RIGHT_PATH =
  "M38.6 31.6 C42.4 35 43.6 40 41.8 44.4 C40.8 47 38.8 49.4 36.2 51.4"

/** Chosen so neither dashed lane ends on a round-cap stub. */
export const LANE_DASHARRAY = "2.2 2.4"
export const LANE_DASHOFFSET_LEFT = "4.1"
export const LANE_DASHOFFSET_RIGHT = "2.35"

const TITLE = "Heavy transport route check"
const STROKE = { small: 5.2, medium: 4.2, full: 3.2 } as const

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
  const showLanes = detail === "full"
  const roadStroke = detail === "small" ? "#F5C518" : `url(#${route})`

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
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#13294B" />
          <stop offset="1" stopColor="#0A1A33" />
        </linearGradient>
        <linearGradient
          id={route}
          x1="6"
          y1="52"
          x2="56"
          y2="11"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F0A500" />
          <stop offset="1" stopColor="#F5C518" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14.5" fill={`url(#${tile})`} />
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="63"
        rx="14"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={routePath}
        stroke={roadStroke}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLanes && (
        <>
          <path
            d={LANE_LEFT_PATH}
            stroke="#FFFFFF"
            strokeOpacity="0.9"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={LANE_DASHARRAY}
            strokeDashoffset={LANE_DASHOFFSET_LEFT}
          />
          <path
            d={LANE_RIGHT_PATH}
            stroke="#FFFFFF"
            strokeOpacity="0.9"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={LANE_DASHARRAY}
            strokeDashoffset={LANE_DASHOFFSET_RIGHT}
          />
        </>
      )}
    </svg>
  )
}
