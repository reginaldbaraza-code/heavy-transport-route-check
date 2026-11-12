/** Max parking sites returned by /api/autobahn-events (keeps the map payload lean). */
export const PARKING_EVENT_CAP = 120

/**
 * Round-robin pick across per-road groups until `limit` is reached.
 *
 * Flattening A1→A10 then slicing fills the cap with A1 alone when A1 has
 * ≥limit usable sites. Interleaving keeps national (and Bavaria) coverage.
 */
export function selectBalancedByGroups<T>(
  groups: readonly (readonly T[])[],
  limit: number = PARKING_EVENT_CAP,
): T[] {
  if (limit <= 0 || groups.length === 0) return []

  const selected: T[] = []
  const cursors = groups.map(() => 0)
  let progressed = true

  while (selected.length < limit && progressed) {
    progressed = false
    for (let i = 0; i < groups.length && selected.length < limit; i += 1) {
      const group = groups[i]
      const cursor = cursors[i]
      if (cursor < group.length) {
        selected.push(group[cursor])
        cursors[i] = cursor + 1
        progressed = true
      }
    }
  }

  return selected
}
