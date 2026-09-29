import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Coins, ExternalLink, Wallet, TrendingUp, Layers } from 'lucide-react'
import { bondingCurveAbi } from '../lib/abis'
import { botTestnet } from '../lib/chains'
import { useCreatorLaunches } from '../hooks/useLaunches'
import { explorerTx, formatBot, shortAddr } from '../lib/config'
import { formatUserError } from '../lib/errors'

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { data: launches = [], all = [], isLoading, refetch } = useCreatorLaunches(address)
  const [claimingCurve, setClaimingCurve] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const onWrongChain = isConnected && chainId !== botTestnet.id
  const totalFeesEst = launches.reduce((sum, l) => sum + Number(l.creatorFees) / 1e18, 0)
  const graduated = launches.filter((l) => l.graduated).length
  const shown = isConnected ? launches : []

  function claimFees(curve: `0x${string}`) {
    setMsg(null)
    reset()
    if (onWrongChain) {
      setMsg('Switch to BOT Chain first.')
      return
    }
    setClaimingCurve(curve)
    writeContract({
      address: curve,
      abi: bondingCurveAbi,
      functionName: 'claimCreatorFees',
      chainId: botTestnet.id,
    })
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker mb-2">Studio</p>
          <h1 className="page-title text-4xl sm:text-5xl lg:text-6xl">Your launches</h1>
          <p className="mt-3 max-w-lg text-base text-spawn-muted sm:text-lg">
            Coins you launched. Claim creator fees anytime.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isConnected && <ConnectButton />}
          {isConnected && onWrongChain && (
            <button
              type="button"
              className="btn-ghost"
              disabled={switching}
              onClick={() => switchChain({ chainId: botTestnet.id })}
            >
              Switch network
            </button>
          )}
          <Link to="/spawn" className="btn-primary">
            New launch
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Layers} label="Your launches" value={isConnected ? String(shown.length) : '—'} />
        <Stat icon={TrendingUp} label="Claimable fees" value={isConnected ? `${formatBot(totalFeesEst)} BOT` : '—'} mono />
        <Stat icon={Wallet} label="Wallet" value={isConnected ? shortAddr(address) : 'Not connected'} />
      </div>

      {!isConnected ? (
        <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="text-spawn-muted">Connect a wallet to see your launches.</p>
          <ConnectButton />
          <p className="text-xs text-spawn-faint">{all.length} launches on Spawn.fun</p>
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-spawn-border px-5 py-4">
            <h2 className="font-display text-lg font-bold">Portfolio</h2>
            <span className="chip">{graduated} graduated</span>
          </div>

          {isLoading ? (
            <div className="px-6 py-12 text-center text-spawn-muted">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-spawn-elev text-spawn-muted">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold">No launches for this wallet</p>
                <p className="mt-1 text-sm text-spawn-muted">Launch your first coin on Spawn.fun.</p>
              </div>
              <Link to="/spawn" className="btn-primary">
                Spawn a coin
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-spawn-border">
              {shown.map((l) => {
                const progress = Math.min(100, l.progressBps / 100)
                const fees = Number(l.creatorFees) / 1e18
                return (
                  <div
                    key={l.id}
                    className="flex flex-col gap-4 px-5 py-4 transition hover:bg-spawn-hover/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-spawn-accent to-spawn-cyan text-xs font-bold">
                        {l.symbol.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {l.name}{' '}
                          <span className="font-mono text-sm font-normal text-spawn-muted">${l.symbol}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-spawn-faint">
                          <span className="font-mono text-spawn-muted">{formatBot(l.raisedBot)} BOT raised</span>
                          <span className="font-mono text-spawn-success">{formatBot(fees)} BOT fees</span>
                          <span>{l.graduated ? 'Graduated' : `${progress.toFixed(0)}% to graduate`}</span>
                        </div>
                        {!l.graduated && (
                          <div className="progress-track mt-2 max-w-[200px]">
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:shrink-0">
                      <button
                        type="button"
                        className="btn-ghost px-3.5 py-2 text-sm"
                        disabled={isPending || confirming || fees <= 0}
                        onClick={() => claimFees(l.curve)}
                      >
                        {claimingCurve === l.curve && (isPending || confirming) ? 'Claiming…' : 'Claim fees'}
                      </button>
                      <Link to={`/token/${l.id}`} className="btn-ghost px-3.5 py-2 text-sm">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {(msg || error) && (
        <p className="text-sm text-spawn-danger">
          {msg || formatUserError(error, 'Claim failed. Try again.')}
        </p>
      )}
      {isSuccess && (
        <p className="text-sm text-spawn-success">
          Claim confirmed.{' '}
          {hash && (
            <a href={explorerTx(hash, botTestnet.id)} target="_blank" rel="noreferrer" className="text-spawn-cyan underline">
              View tx
            </a>
          )}
        </p>
      )}
      {isConnected && (
        <button type="button" className="text-xs text-spawn-faint hover:text-white" onClick={() => refetch()}>
          Refresh portfolio
        </button>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Wallet
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-spawn-elev text-spawn-accent-soft">
        <Icon className="h-5 w-5" />
      </div>
      <div className="label">{label}</div>
      <div className={`mt-2 truncate text-2xl font-bold sm:text-3xl ${mono ? 'font-mono' : 'font-display'}`}>
        {value}
      </div>
    </div>
  )
}
