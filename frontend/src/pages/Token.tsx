import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { parseEther, formatEther, maxUint256, zeroAddress } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { bondingCurveAbi, erc20Abi } from '../lib/abis'
import { botTestnet } from '../lib/chains'
import { useLaunch } from '../hooks/useLaunches'
import { useTradeHistory } from '../hooks/useTradeHistory'
import { PriceChart } from '../components/PriceChart'
import { TradeTape } from '../components/TradeTape'
import {
  bdexSwapUrl,
  explorerAddress,
  explorerTx,
  formatBot,
  shortAddr,
} from '../lib/config'
import { formatUserError } from '../lib/errors'

const PCTS = [25, 50, 75, 100] as const

function safeParseEther(value: string): bigint | null {
  const v = value.trim()
  if (!v || v === '.' || v.endsWith('.')) return null
  try {
    return parseEther(v)
  } catch {
    return null
  }
}

/** Trim long decimal strings for inputs without scientific notation. */
function fmtInput(wei: bigint, decimals = 6): string {
  const raw = formatEther(wei)
  if (!raw.includes('.')) return raw
  const [i, d = ''] = raw.split('.')
  const trimmed = d.slice(0, decimals).replace(/0+$/, '')
  return trimmed ? `${i}.${trimmed}` : i
}

export function Token() {
  const { id } = useParams()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: switching } = useSwitchChain()
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('0.1')
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const { data: launch, isLoading, isError, error, refetch } = useLaunch(id)
  const { data: trades = [], isLoading: tradesLoading } = useTradeHistory(launch?.curve)

  const { data: botBalance } = useBalance({
    address,
    chainId: botTestnet.id,
    query: { enabled: Boolean(address) },
  })

  const { data: tokenBalance, refetch: refetchTokenBal } = useReadContract({
    address: launch?.token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(launch?.token && address) },
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: launch?.token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && launch ? [address, launch.curve] : undefined,
    query: { enabled: Boolean(launch?.token && address) },
  })

  const { data: liveGraduated, refetch: refetchGraduated } = useReadContract({
    address: launch?.curve,
    abi: bondingCurveAbi,
    functionName: 'graduated',
    query: { enabled: Boolean(launch?.curve), refetchInterval: 5_000 },
  })

  const { data: reserves } = useReadContract({
    address: launch?.curve,
    abi: bondingCurveAbi,
    functionName: 'getReserves',
    query: { enabled: Boolean(launch?.curve), refetchInterval: 5_000 },
  })

  // Graduation is a status milestone — trading stays open on Spawn AMM
  const isGraduated = liveGraduated === true || launch?.graduated === true

  const parsedAmount = safeParseEther(amount)

  const { data: buyQuote } = useReadContract({
    address: launch?.curve,
    abi: bondingCurveAbi,
    functionName: 'quoteBuy',
    args: parsedAmount != null && parsedAmount > 0n ? [parsedAmount] : undefined,
    query: {
      enabled: Boolean(launch?.curve && side === 'buy' && parsedAmount != null && parsedAmount > 0n),
    },
  })

  const { data: sellQuote } = useReadContract({
    address: launch?.curve,
    abi: bondingCurveAbi,
    functionName: 'quoteSell',
    args: parsedAmount != null && parsedAmount > 0n ? [parsedAmount] : undefined,
    query: {
      enabled: Boolean(launch?.curve && side === 'sell' && parsedAmount != null && parsedAmount > 0n),
    },
  })

  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const onWrongChain = isConnected && chainId !== botTestnet.id
  const progress = launch ? Math.min(100, launch.progressBps / 100) : 0

  const spot = useMemo(() => {
    if (!reserves) return null
    const [botR, tokR] = reserves
    if (tokR === 0n) return null
    const price = Number(formatEther(botR)) / Number(formatEther(tokR))
    return { price, mcap: price * 1_000_000_000 }
  }, [reserves])

  const lastTrade = trades.length ? trades[trades.length - 1] : null
  const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null
  const changePct =
    lastTrade && prevTrade && prevTrade.mcap > 0
      ? ((lastTrade.mcap - prevTrade.mcap) / prevTrade.mcap) * 100
      : 0

  const needsApprove = useMemo(() => {
    if (side !== 'sell' || parsedAmount == null || parsedAmount <= 0n) return false
    return (allowance ?? 0n) < parsedAmount
  }, [side, parsedAmount, allowance])

  function setPercent(pct: number) {
    if (side === 'buy') {
      const bal = botBalance?.value ?? 0n
      if (bal === 0n) {
        setAmount('0')
        return
      }
      // Leave a tiny gas buffer on 100% buys
      const spendable = pct === 100 ? (bal > parseEther('0.002') ? bal - parseEther('0.002') : bal) : bal
      setAmount(fmtInput((spendable * BigInt(pct)) / 100n))
      return
    }
    const bal = tokenBalance ?? 0n
    if (bal === 0n) {
      setAmount('0')
      return
    }
    setAmount(fmtInput((bal * BigInt(pct)) / 100n, 8))
  }

  function onAmountChange(raw: string) {
    // Allow clearing and intermediate decimal typing
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setAmount(raw)
    }
  }

  async function copyAddr(value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  async function trade() {
    if (!launch) return
    setMsg(null)
    reset()

    if (!isConnected || !address) {
      setMsg('Connect a wallet first.')
      return
    }
    if (onWrongChain) {
      setMsg('Switch to BOT Chain to continue.')
      return
    }
    if (parsedAmount == null || parsedAmount <= 0n) {
      setMsg('Enter a valid amount.')
      return
    }

    try {
      if (side === 'buy') {
        await writeContractAsync({
          address: launch.curve,
          abi: bondingCurveAbi,
          functionName: 'buy',
          args: [0n, zeroAddress],
          value: parsedAmount,
          chainId: botTestnet.id,
        })
      } else {
        if (needsApprove) {
          await writeContractAsync({
            address: launch.token,
            abi: erc20Abi,
            functionName: 'approve',
            args: [launch.curve, maxUint256],
            chainId: botTestnet.id,
          })
          await refetchAllowance()
          setMsg('Approved. Confirm the sell…')
        }
        await writeContractAsync({
          address: launch.curve,
          abi: bondingCurveAbi,
          functionName: 'sell',
          args: [parsedAmount, 0n],
          chainId: botTestnet.id,
        })
      }
      await Promise.all([refetch(), refetchGraduated(), refetchTokenBal()])
    } catch (e) {
      setMsg(formatUserError(e, 'Transaction failed. Try again.'))
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b10] px-6 py-20 text-center text-base text-zinc-500">
        Loading market…
      </div>
    )
  }

  if (isError || !launch) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-white/[0.08] bg-[#0b0b10] px-6 py-16 text-center">
        <p className="font-display text-2xl font-semibold">Token not found</p>
        <p className="text-base text-zinc-500">
          {isError
            ? formatUserError(error, 'This launch could not be loaded.')
            : 'Check the launch id or return to markets.'}
        </p>
        <Link to="/" className="btn-primary mt-2 inline-flex">
          Back to markets
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-base text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          Markets
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <span className="chip">Testnet</span>
          {isGraduated ? (
            <span className="chip-live">Graduated</span>
          ) : (
            <span className="chip">{progress.toFixed(0)}% to graduate</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-5 rounded-xl border border-cyan-500/15 bg-[#08080c] p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-base font-bold text-black">
            {launch.imageURI ? (
              <img src={launch.imageURI} alt="" className="h-full w-full object-cover" />
            ) : (
              launch.symbol.slice(0, 2)
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h1 className="page-title text-3xl sm:text-4xl">{launch.name}</h1>
              <span className="font-mono text-base text-zinc-500 sm:text-lg">${launch.symbol}</span>
            </div>
            <p className="mt-1.5 max-w-2xl text-base text-zinc-400 line-clamp-2">
              {launch.description || 'No description'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-7 sm:gap-10">
          <Metric
            label="Market cap"
            value={`${formatBot(spot?.mcap ?? lastTrade?.mcap ?? 0)} BOT`}
            sub={
              changePct !== 0 ? (
                <span className={changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {changePct >= 0 ? '+' : ''}
                  {changePct.toFixed(2)}%
                </span>
              ) : (
                <span className="text-zinc-600">—</span>
              )
            }
          />
          <Metric label="Raised" value={`${formatBot(launch.raisedBot)} BOT`} />
          <Metric label="Trades" value={String(trades.length)} />
          <Metric
            label="Token"
            value={
              <button
                type="button"
                onClick={() => copyAddr(launch.token)}
                className="inline-flex items-center gap-1.5 font-mono text-base text-zinc-100 hover:text-cyan-300"
              >
                {shortAddr(launch.token)}
                <Copy className="h-4 w-4 text-zinc-500" />
              </button>
            }
          />
        </div>
      </div>

      {copied && <p className="text-sm text-cyan-300">Address copied</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <PriceChart trades={trades} spotMcap={spot?.mcap} height={420} />
          {tradesLoading && trades.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b10] px-4 py-10 text-center text-base text-zinc-500">
              Loading trade history…
            </div>
          ) : (
            <TradeTape trades={trades} symbol={launch.symbol} />
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-xl border border-cyan-500/15 bg-[#08080c] p-5">
            <div className="mb-5 flex gap-1.5 rounded-lg bg-black/45 p-1.5">
              {(['buy', 'sell'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSide(s)
                    setMsg(null)
                    setAmount(s === 'buy' ? '0.1' : '')
                  }}
                  className={`flex-1 rounded-lg py-3 text-base font-bold capitalize transition ${
                    side === s
                      ? s === 'buy'
                        ? 'bg-emerald-500 text-black'
                        : 'bg-rose-500 text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {isGraduated && (
              <div className="mb-4 space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                <div className="font-semibold text-emerald-300">Graduated — trading is live</div>
                <p className="leading-relaxed text-emerald-100/85">
                  Launch goal reached. Buy and sell keep working right here.
                </p>
                <a
                  href={bdexSwapUrl(launch.token)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-emerald-200 underline-offset-2 hover:underline"
                >
                  Also trade on Swap <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Trade
            </div>

            <label className="block space-y-2.5">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>{side === 'buy' ? 'Pay (BOT)' : `Sell ($${launch.symbol})`}</span>
                <span className="font-mono text-zinc-300">
                  {side === 'buy'
                    ? `Bal ${formatBot(botBalance?.value ?? 0n)} BOT`
                    : `Bal ${formatBot(tokenBalance ?? 0n)} $${launch.symbol}`}
                </span>
              </div>
              <input
                className="w-full rounded-lg border border-white/[0.1] bg-black/50 px-4 py-3.5 font-mono text-lg text-white outline-none focus:border-cyan-500/50"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.0"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
              />
            </label>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {PCTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={!isConnected}
                  onClick={() => setPercent(pct)}
                  className="rounded-lg border border-white/[0.1] bg-white/[0.03] py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-cyan-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pct}%
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-black/35 px-4 py-3.5 text-sm">
              <Row label="Fee" value="1.25%" />
              {side === 'buy' && buyQuote ? (
                <Row label="You receive" value={`~${formatBot(buyQuote[0])} $${launch.symbol}`} mono />
              ) : null}
              {side === 'sell' && sellQuote ? (
                <Row label="You receive" value={`~${formatBot(sellQuote[0])} BOT`} mono />
              ) : null}
              <Row label="Progress" value={`${progress.toFixed(1)}%`} />
            </div>

            <div className="mt-5">
              {!isConnected ? (
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              ) : onWrongChain ? (
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={switching}
                  onClick={() => switchChain({ chainId: botTestnet.id })}
                >
                  {switching ? 'Switching…' : 'Switch to BOT Chain'}
                </button>
              ) : (
                <button
                  type="button"
                  className={
                    side === 'buy'
                      ? 'inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 py-3.5 text-base font-bold text-black transition hover:brightness-110 disabled:opacity-45'
                      : 'inline-flex w-full items-center justify-center rounded-xl bg-rose-500 py-3.5 text-base font-bold text-white transition hover:brightness-110 disabled:opacity-45'
                  }
                  onClick={trade}
                  disabled={isPending || confirming || parsedAmount == null || parsedAmount <= 0n}
                >
                  {isPending || confirming
                    ? 'Confirm in wallet…'
                    : side === 'sell' && needsApprove
                      ? `Approve & sell $${launch.symbol}`
                      : `${side === 'buy' ? 'Buy' : 'Sell'} $${launch.symbol}`}
                </button>
              )}
            </div>

            {(msg || writeError) && (
              <p className="mt-3 text-center text-sm text-rose-400">
                {msg || formatUserError(writeError, 'Transaction failed. Try again.')}
              </p>
            )}
            {isSuccess && <p className="mt-3 text-center text-sm text-emerald-400">Trade confirmed</p>}
            {hash && (
              <a
                href={explorerTx(hash, botTestnet.id)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 font-mono text-sm text-zinc-500 hover:text-cyan-300"
              >
                View transaction <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b10] p-5 text-sm text-zinc-500">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Details
            </div>
            <div className="space-y-3">
              <AddrRow label="Token" addr={launch.token} />
              <AddrRow label="Market" addr={launch.curve} />
              <AddrRow label="Creator" addr={launch.creator} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1.5 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
        {value}
      </div>
      {sub && <div className="mt-1 text-sm">{sub}</div>}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className={`text-zinc-100 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function AddrRow({ label, addr }: { label: string; addr: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <a
        href={explorerAddress(addr, botTestnet.id)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 font-mono text-zinc-300 hover:text-cyan-300"
      >
        {shortAddr(addr)}
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  )
}
