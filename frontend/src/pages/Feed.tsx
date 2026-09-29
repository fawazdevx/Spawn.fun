import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Rocket, Flame, Clock, Trophy, RefreshCw } from 'lucide-react'
import { TokenCard } from '../components/TokenCard'
import { useLaunches } from '../hooks/useLaunches'
import { formatBot, type LaunchView } from '../lib/config'
import { formatUserError } from '../lib/errors'

type Tab = 'live' | 'new' | 'graduating' | 'graduated'

export function Feed() {
  const [tab, setTab] = useState<Tab>('live')
  const { data: launches = [], isLoading, isError, error, refetch, isFetching } = useLaunches()

  const filtered = useMemo(() => {
    const list = [...launches]
    if (tab === 'new') return list.sort((a, b) => b.createdAt - a.createdAt)
    if (tab === 'graduating')
      return list
        .filter((l) => !l.graduated && l.progressBps >= 5000)
        .sort((a, b) => b.progressBps - a.progressBps)
    if (tab === 'graduated') return list.filter((l) => l.graduated)
    return list.sort((a, b) => b.progressBps - a.progressBps)
  }, [launches, tab])

  const stats = useMemo(() => {
    const live = launches.filter((l) => !l.graduated).length
    const graduated = launches.filter((l) => l.graduated).length
    const volume = launches.reduce((s, l) => s + l.raisedBot, 0)
    return { live, graduated, volume: formatBot(volume), total: launches.length }
  }, [launches])

  const tabs: { id: Tab; label: string; icon: typeof Flame }[] = [
    { id: 'live', label: 'Trending', icon: Flame },
    { id: 'new', label: 'New', icon: Clock },
    { id: 'graduating', label: 'Almost', icon: Rocket },
    { id: 'graduated', label: 'Graduated', icon: Trophy },
  ]

  return (
    <div className="space-y-8">
      <div className="sys-bar mb-2">
        <span className="text-cyan-400">Spawn.fun</span>
        <span className="text-zinc-600">/</span>
        <span>Markets feed</span>
        <span className="hidden text-zinc-500 sm:inline">Creators earn from every trade</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="page-kicker mb-2">Live markets</p>
          <h1 className="page-title text-4xl sm:text-5xl lg:text-6xl">Markets</h1>
          <p className="mt-3 max-w-xl text-base text-zinc-400 sm:text-lg">
            Fair launches on BOT Chain. Spawn it. Trade it.
          </p>
        </div>
        <Link to="/spawn" className="btn-primary text-base">
          <Rocket className="h-5 w-5" />
          Launch token
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Launches" value={String(stats.total)} />
        <Stat label="On curve" value={String(stats.live)} />
        <Stat label="Graduated" value={String(stats.graduated)} />
        <Stat label="BOT raised" value={stats.volume} mono />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0b0b10] p-1.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${
                tab === id
                  ? 'bg-cyan-500/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost px-4 py-2.5 text-sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b10] px-6 py-20 text-center text-base text-zinc-500">
          Loading markets…
        </div>
      ) : isError ? (
        <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#0b0b10] px-6 py-12 text-center">
          <p className="text-lg text-rose-400">Couldn&apos;t load markets</p>
          <p className="text-base text-zinc-500">
            {formatUserError(error, 'Network issue. Check your connection and retry.')}
          </p>
          <button type="button" className="btn-primary mx-auto" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#0b0b10] px-6 py-20 text-center">
          <p className="text-xl font-semibold">No launches yet</p>
          <p className="text-base text-zinc-500">Be the first to launch here.</p>
          <Link to="/spawn" className="btn-primary mt-1">
            Launch token
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((launch: LaunchView) => (
            <TokenCard key={launch.id} launch={launch} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b10] px-4 py-4 sm:px-5 sm:py-5">
      <div className="label">{label}</div>
      <div
        className={`mt-2 text-2xl font-bold tracking-tight sm:text-3xl ${
          mono ? 'font-mono' : 'font-display'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
