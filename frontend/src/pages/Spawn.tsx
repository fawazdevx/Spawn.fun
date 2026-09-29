import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { parseEther, decodeEventLog, zeroAddress } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Rocket, Sparkles, Info, ExternalLink } from 'lucide-react'
import { ImageUpload } from '../components/ImageUpload'
import { spawnFactoryAbi } from '../lib/abis'
import { botTestnet } from '../lib/chains'
import { explorerTx, FACTORY_ADDRESS } from '../lib/config'
import { formatUserError } from '../lib/errors'

export function Spawn() {
  const navigate = useNavigate()
  const chainId = useChainId()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { isConnected } = useAccount()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [imageURI, setImageURI] = useState('')
  const [description, setDescription] = useState('')
  const [seedBuy, setSeedBuy] = useState('0')
  const [agentMode, setAgentMode] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const trimmedName = name.trim()
  const trimmedSymbol = symbol.trim()
  const trimmedImage = imageURI.trim()
  const trimmedDesc = description.trim()

  const { data: nameTaken } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: spawnFactoryAbi,
    functionName: 'isNameTaken',
    args: [trimmedName],
    query: { enabled: trimmedName.length > 0 },
  })

  const { data: symbolTaken } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: spawnFactoryAbi,
    functionName: 'isSymbolTaken',
    args: [trimmedSymbol],
    query: { enabled: trimmedSymbol.length > 0 },
  })

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const onWrongChain = isConnected && chainId !== botTestnet.id
  const initials = (symbol || name || '??').slice(0, 2).toUpperCase()

  const validationError = useMemo(() => {
    if (!trimmedName || !trimmedSymbol) return 'Name and symbol are required.'
    if (!trimmedImage) return 'Image is required — upload a file or paste a URL before spawning.'
    if (!trimmedDesc) return 'Description is required — tell the story of this coin.'
    if (nameTaken) return `Name "${trimmedName}" is already taken — pick a different name.`
    if (symbolTaken) return `Ticker $${trimmedSymbol.toUpperCase()} is already taken — change the symbol.`
    return null
  }, [trimmedName, trimmedSymbol, trimmedImage, trimmedDesc, nameTaken, symbolTaken])

  const canSubmit = !validationError

  useEffect(() => {
    if (!isSuccess || !receipt) return
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: spawnFactoryAbi,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'TokenSpawned') {
          const id = Number((decoded.args as { id: bigint }).id)
          setStatus(`Spawned #${id}`)
          navigate(`/token/${id}`)
          return
        }
      } catch {
        // not our event
      }
    }
    setStatus('Spawn confirmed — open Markets if redirect missed the id.')
  }, [isSuccess, receipt, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    reset()

    if (validationError) {
      setStatus(validationError)
      return
    }
    if (!isConnected) {
      setStatus('Connect a wallet first.')
      return
    }
    if (onWrongChain) {
      setStatus('Switch to BOT Chain testnet (968).')
      return
    }

    const finalDescription = agentMode
      ? `${trimmedDesc}\n\n[Agent Spawn]`
      : trimmedDesc

    writeContract({
      address: FACTORY_ADDRESS,
      abi: spawnFactoryAbi,
      functionName: 'spawn',
      args: [
        trimmedName,
        trimmedSymbol.toUpperCase(),
        trimmedImage,
        finalDescription,
        zeroAddress,
      ],
      value: seedBuy && Number(seedBuy) > 0 ? parseEther(seedBuy) : 0n,
      chainId: botTestnet.id,
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4 animate-fade-up">
        <div>
          <p className="page-kicker mb-2">Sys · Create</p>
          <h1 className="page-title text-4xl sm:text-5xl lg:text-6xl">Spawn a coin</h1>
          <p className="mt-3 max-w-md text-base text-spawn-muted sm:text-lg">
            Broadcasts to SpawnFactory on BOT testnet. Fixed 1B supply · anti-snipe · SPAWN buyback
            fees.
          </p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-6 p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *">
              <input
                className={`input ${nameTaken ? 'border-rose-500/50' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Agent Cat"
                maxLength={32}
                required
              />
              {nameTaken ? (
                <p className="mt-1.5 text-sm text-rose-400">
                  This name is taken — choose another.
                </p>
              ) : null}
            </Field>
            <Field label="Symbol *">
              <input
                className={`input font-mono uppercase ${symbolTaken ? 'border-rose-500/50' : ''}`}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="ACAT"
                maxLength={10}
                required
              />
              {symbolTaken ? (
                <p className="mt-1.5 text-sm text-rose-400">
                  Ticker already exists — change the symbol.
                </p>
              ) : null}
            </Field>
          </div>

          <Field label="Image *">
            <ImageUpload
              value={imageURI}
              onChange={setImageURI}
              disabled={isPending || confirming}
            />
          </Field>

          <Field label="Description *">
            <textarea
              className="input min-h-[100px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What’s the meme? What’s the agent?"
              required
            />
            <p className="mt-1.5 text-xs text-spawn-faint">Required. Token will not spawn without a description.</p>
          </Field>

          <Field label="Seed buy (BOT)">
            <input
              className="input font-mono"
              type="number"
              min="0"
              step="0.01"
              value={seedBuy}
              onChange={(e) => setSeedBuy(e.target.value)}
            />
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-spawn-faint">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Optional first buy in the same tx. Only the creator can buy on the launch block.
            </p>
          </Field>

          <button
            type="button"
            onClick={() => setAgentMode((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
              agentMode
                ? 'border-cyan-500/50 bg-cyan-500/10'
                : 'border-spawn-border bg-spawn-elev/60 hover:border-spawn-border-strong'
            }`}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                agentMode ? 'bg-cyan-400 text-black' : 'bg-spawn-hover text-spawn-muted'
              }`}
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-semibold">Agent Spawn</span>
              <span className="block text-sm text-spawn-muted">
                Tags the description for Agent Wallet fee streaming
              </span>
            </span>
            <span className={`h-5 w-9 rounded-full p-0.5 transition ${agentMode ? 'bg-cyan-400' : 'bg-spawn-border'}`}>
              <span className={`block h-4 w-4 rounded-full bg-white transition ${agentMode ? 'translate-x-4' : ''}`} />
            </span>
          </button>

          {!isConnected ? (
            <div className="flex justify-center py-2">
              <ConnectButton />
            </div>
          ) : onWrongChain ? (
            <button
              type="button"
              className="btn-primary w-full py-3.5"
              disabled={switching}
              onClick={() => switchChain({ chainId: botTestnet.id })}
            >
              {switching ? 'Switching…' : 'Switch to BOT testnet'}
            </button>
          ) : (
            <button
              type="submit"
              className="btn-primary w-full py-3.5"
              disabled={isPending || confirming || !canSubmit}
            >
              <Rocket className="h-4 w-4" />
              {isPending || confirming ? 'Confirm in wallet…' : 'Spawn on BOT testnet'}
            </button>
          )}

          {validationError && isConnected && !onWrongChain && (
            <p className="text-sm text-amber-300">{validationError}</p>
          )}
          {status && <p className="text-sm text-spawn-success">{status}</p>}
          {error && (
            <p className="text-sm text-spawn-danger">{formatUserError(error)}</p>
          )}
          {hash && (
            <a
              href={explorerTx(hash, botTestnet.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-spawn-cyan hover:underline"
            >
              {hash.slice(0, 10)}… <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </form>
      </div>

      <aside className="space-y-4 animate-fade-up lg:sticky lg:top-24 lg:self-start" style={{ animationDelay: '80ms' }}>
        <p className="page-kicker">Preview</p>
        <div className="card overflow-hidden">
          <div className="relative h-44 bg-gradient-to-br from-cyan-500/30 via-spawn-panel to-violet-500/20">
            <div className="absolute inset-0 bg-grid-fade bg-[size:24px_24px] opacity-40" />
            <div className="absolute bottom-5 left-5 flex items-end gap-3.5">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xl font-bold text-black shadow-glow ring-2 ring-spawn-bg">
                {imageURI ? <img src={imageURI} alt="" className="h-full w-full object-cover" /> : initials}
              </div>
              <div className="pb-1">
                <div className="font-display text-2xl font-bold">{name || 'Token name'}</div>
                <div className="font-mono text-base text-spawn-muted">${symbol || 'TICKER'}</div>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <p className="text-base leading-relaxed text-spawn-muted">
              {description || 'Your description will show on the token page after spawn.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="chip">1B supply</span>
              <span className="chip">1.25% fee</span>
              <span className="chip">SPAWN buyback</span>
              <span className="chip-live">chain 968</span>
              {agentMode && <span className="chip border-cyan-500/40 text-cyan-300">Agent</span>}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2.5">
      <span className="text-sm font-semibold uppercase tracking-[0.12em] text-spawn-muted">{label}</span>
      {children}
    </label>
  )
}


