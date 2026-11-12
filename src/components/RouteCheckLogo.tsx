export type RouteCheckLogoProps = {
  size?: number
  tone?: "dark" | "light" | "auto"
  decorative?: boolean
  className?: string
}

export type LogoDetail = "small" | "full"

/** Autobahn Plate — fixed brand blue (light-mode --accent), not dark-mode accent. */
export const PLATE = "#0071e3"
export const ROAD_FILL = "#ffffff"
export const CHECKPOINT = "#f5c518"
export const NAVY = "#0c2439"

/** 64-unit master geometry */
export const ROAD_64 = "M30 24 H34 L50 52 H14 Z"
export const DASHES_64 = [
  [30, 38, 4, 5],
  [30, 46, 4, 6],
] as const
export const DIAMOND_64 = "M32 15 L42 25 L32 35 L22 25 Z"

/** 16-grid master geometry (integer rects) */
export const ROAD_16 = [
  [7, 3, 2, 2],
  [6, 5, 4, 2],
  [5, 7, 6, 2],
  [4, 9, 8, 2],
  [3, 11, 10, 2],
] as const
export const DASH_16 = [7, 11, 2, 2] as const
export const CHECK_RING_16 = [5, 4, 6, 5] as const
export const CHECK_16 = [6, 5, 4, 3] as const

const TITLE = "Heavy transport route check"

export function logoDetailForSize(size: number): LogoDetail {
  return size <= 20 ? "small" : "full"
}

function Mark64({ plate }: { plate: "light" | "dark" }) {
  return (
    <>
      {plate === "light" ? (
        <>
          <rect width="64" height="64" rx="14" fill={PLATE} />
          <rect
            x="5.5"
            y="5.5"
            width="53"
            height="53"
            rx="9"
            fill="none"
            stroke={ROAD_FILL}
            strokeWidth="3"
          />
        </>
      ) : (
        <>
          <rect width="64" height="64" rx="14" fill={ROAD_FILL} />
          <rect x="3" y="3" width="58" height="58" rx="11" fill={PLATE} />
        </>
      )}
      <path fill={ROAD_FILL} d={ROAD_64} />
      {DASHES_64.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={PLATE} />
      ))}
      <path
        fill={CHECKPOINT}
        stroke={NAVY}
        strokeWidth="3"
        strokeLinejoin="miter"
        d={DIAMOND_64}
      />
    </>
  )
}

function Mark16({ plate }: { plate: "light" | "dark" }) {
  return (
    <>
      {plate === "light" ? (
        <rect width="16" height="16" rx="3" fill={PLATE} />
      ) : (
        <>
          <rect width="16" height="16" rx="3" fill={ROAD_FILL} />
          <rect x="1" y="1" width="14" height="14" rx="2" fill={PLATE} />
        </>
      )}
      {ROAD_16.map(([x, y, w, h]) => (
        <rect
          key={`${x}-${y}-${w}`}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={ROAD_FILL}
        />
      ))}
      <rect
        x={DASH_16[0]}
        y={DASH_16[1]}
        width={DASH_16[2]}
        height={DASH_16[3]}
        fill={PLATE}
      />
      <rect
        x={CHECK_RING_16[0]}
        y={CHECK_RING_16[1]}
        width={CHECK_RING_16[2]}
        height={CHECK_RING_16[3]}
        fill={NAVY}
      />
      <rect
        x={CHECK_16[0]}
        y={CHECK_16[1]}
        width={CHECK_16[2]}
        height={CHECK_16[3]}
        fill={CHECKPOINT}
      />
    </>
  )
}

export default function RouteCheckLogo({
  size = 32,
  tone = "auto",
  decorative = false,
  className,
}: RouteCheckLogoProps) {
  const detail = logoDetailForSize(size)
  const viewBox = detail === "small" ? "0 0 16 16" : "0 0 64 64"
  const auto = tone === "auto"
  const showLight = tone === "light" || auto
  const showDark = tone === "dark" || auto
  const Mark = detail === "small" ? Mark16 : Mark64

  return (
    <svg
      className={[className, auto ? "rc-logo-auto" : undefined]
        .filter(Boolean)
        .join(" ")}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      shapeRendering="geometricPrecision"
      data-tone={tone}
      data-detail={detail}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : TITLE}
    >
      {!decorative && <title>{TITLE}</title>}
      {showLight && (
        <g className="rc-logo-light">
          <Mark plate="light" />
        </g>
      )}
      {showDark && (
        <g className="rc-logo-dark">
          <Mark plate="dark" />
        </g>
      )}
    </svg>
  )
}
