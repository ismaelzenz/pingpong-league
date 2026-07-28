// Skeleton shown during navigation between app pages while the (dynamic) server render is in
// flight. A content-shaped placeholder (title + rows) reads as "loading this page" rather than a
// bare spinner, and the nav bar stays put around it.
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-muted" />
        <div className="h-4 w-32 rounded bg-muted/70" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
            <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 rounded bg-muted" />
              <div className="h-3 w-1/4 rounded bg-muted/70" />
            </div>
            <div className="h-6 w-12 rounded bg-muted shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
