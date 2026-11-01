/**
 * A standings row's rank change this matchday: ▲2 / ▼1 / – ; nothing when it isn't known.
 * `quiet` drops the "–" for an unchanged rank, so only real moves draw the eye in a long table.
 */
export default function RankMovement({ movement, quiet = false }: { movement: number | null; quiet?: boolean }) {
  if (movement == null) return null
  if (movement > 0) return <span className="text-green-500">▲{movement}</span>
  if (movement < 0) return <span className="text-red-500">▼{Math.abs(movement)}</span>
  return quiet ? null : <span className="text-muted-foreground">–</span>
}
