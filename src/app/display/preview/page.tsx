import DisplayBoard from '@/components/display/DisplayBoard'
import { PREVIEW } from '@/components/display/previewData'

// Hardcoded preview of the office board — no database, safe in production. Lets you check exactly
// how /display will look on the TV before the season starts and has any real data.
export const metadata = { title: 'Display preview' }

export default function DisplayPreviewPage() {
  return <DisplayBoard tournamentName="Zenz Ping Pong League (preview)" data={PREVIEW} demoCelebrationMs={4000} />
}
