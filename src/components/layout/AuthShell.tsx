/**
 * The centred, logo-topped frame around the signed-out pages (sign in, register, password reset,
 * invite links). `tight` trims the gap under the logo for pages whose card carries its own heading.
 */
export default function AuthShell({ subtitle, tight = false, children }: {
  subtitle?: React.ReactNode
  tight?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className={`text-center ${tight ? 'mb-6' : 'mb-8'}`}>
          <div className="text-5xl mb-3">🏓</div>
          <h1 className="text-2xl font-bold">Ping Pong League</h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
