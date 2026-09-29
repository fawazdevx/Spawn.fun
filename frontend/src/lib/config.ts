import { getAddress, type Address, formatEther } from 'viem'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

function optionalAddress(raw: string | undefined): Address | undefined {
  if (!raw) return undefined
  try {
    return getAddress(raw) as Address
  } catch {
    return undefined
  }
}

const rawFactory = import.meta.env.VITE_FACTORY_ADDRESS as string | undefined
const parsedFactory = optionalAddress(rawFactory)

/** False when VITE_FACTORY_ADDRESS is missing or invalid — UI should show a friendly gate. */
export const isAppConfigured = Boolean(parsedFactory)

/** Factory address; zero address when not configured (hooks should be disabled via isAppConfigured). */
export const FACTORY_ADDRESS = (parsedFactory ?? ZERO_ADDRESS) as Address

/** Platform token + buyback stack (set after economy deploy). */
export const SPAWN_TOKEN = optionalAddress(import.meta.env.VITE_SPAWN_TOKEN)
export const SPAWN_MARKET = optionalAddress(import.meta.env.VITE_SPAWN_MARKET)
export const BUYBACK_VAULT = optionalAddress(import.meta.env.VITE_BUYBACK_VAULT)
export const FEE_ROUTER = optionalAddress(import.meta.env.VITE_FEE_ROUTER)

export type LaunchView = {
  id: number
  token: Address
  curve: Address
  creator: Address
  name: string
  symbol: string
  imageURI: string
  description: string
  createdAt: number
  progressBps: number
  raisedBot: number
  graduated: boolean
  creatorFees: bigint
}

export function shortAddr(addr?: string) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatBot(value: number | string | bigint) {
  if (typeof value === 'bigint') {
    const n = Number(formatEther(value))
    return formatBot(n)
  }
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '0'
  if (n >= 1000) return n.toFixed(0)
  if (n >= 1) return n.toFixed(3)
  if (n === 0) return '0'
  return n.toFixed(4)
}

export function explorerTx(hash: string, chainId?: number) {
  const base = chainId === 677 ? 'https://scan.botchain.ai' : 'https://scan.bohr.life'
  return `${base}/tx/${hash}`
}

export function explorerAddress(addr: string, chainId?: number) {
  const base = chainId === 677 ? 'https://scan.botchain.ai' : 'https://scan.bohr.life'
  return `${base}/address/${addr}`
}

/** BDEX swap deep-link (best-effort; pair may need manual select on testnet). */
export function bdexSwapUrl(token: string) {
  return `https://dex.botchain.ai/swap?outputCurrency=${token}`
}
