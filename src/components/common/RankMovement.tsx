/** A standings row's rank change this matchday: ▲2 / ▼1 / – ; nothing when it isn't known. */
export default function RankMovement({ movement }: { movement: number | null }) {
  if (movement == null) return null
  if (movement > 0) return <span className="text-green-500">▲{movement}</span>
  if (movement < 0) return <span className="text-red-500">▼{Math.abs(movement)}</span>
  return <span className="text-muted-foreground">–</span>
}
