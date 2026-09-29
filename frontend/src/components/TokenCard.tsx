import { Link } from 'react-router-dom'
import { formatBot, shortAddr, type LaunchView } from '../lib/config'

type Props = {
  launch: LaunchView
  index?: number
}

export function TokenCard({ launch }: Props) {
  const progress = Math.min(100, launch.progressBps / 100)
  const initials = launch.symbol.slice(0, 2).toUpperCase()

  return (
    <Link
      to={`/token/${launch.id}`}
      className="group block rounded-xl border border-white/[0.08] bg-[#08080c] p-5 transition hover:border-cyan-500/35 hover:bg-[#0c0e14]"
    >
      <div className="flex items-start gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-bold text-black">
          {launch.imageURI ? (
            <img src={launch.imageURI} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
          {launch.graduated && (
            <span className="absolute -bottom-1 -right-1 rounded bg-emerald-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-black">
              LIVE
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-lg font-semibold tracking-tight group-hover:text-cyan-100">
              {launch.name}
            </h3>
            <span className="shrink-0 font-mono text-sm text-zinc-500">${launch.symbol}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-500">
            {launch.description || 'No description'}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className={launch.graduated ? 'font-medium text-emerald-400' : 'text-zinc-400'}>
            {launch.graduated ? 'Graduated' : `${progress.toFixed(0)}% to graduate`}
          </span>
          <span className="font-mono text-base text-zinc-200">{formatBot(launch.raisedBot)} BOT</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-zinc-600 sm:text-sm">
          <span className="font-mono">{shortAddr(launch.creator)}</span>
          <span>
            {launch.createdAt
              ? new Date(launch.createdAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </span>
        </div>
      </div>
    </Link>
  )
}
