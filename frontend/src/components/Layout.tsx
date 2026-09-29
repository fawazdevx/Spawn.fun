import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Sparkles, Rocket, LayoutDashboard, ExternalLink } from 'lucide-react'
import { FACTORY_ADDRESS, isAppConfigured, shortAddr, explorerAddress } from '../lib/config'
import { botTestnet } from '../lib/chains'

const nav = [
  { to: '/', label: 'Markets', icon: Sparkles },
  { to: '/spawn', label: 'Launch', icon: Rocket },
  { to: '/dashboard', label: 'Studio', icon: LayoutDashboard },
]

const year = new Date().getFullYear()

export function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="glass-header sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
          <div className="flex items-center gap-7">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400 font-mono text-sm font-bold text-black shadow-[0_0_28px_-6px_rgba(34,211,238,0.85)]">
                S
              </span>
              <span className="font-display text-lg font-bold tracking-tight sm:text-xl">
                Spawn<span className="text-zinc-500">.fun</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {nav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => (isActive ? 'nav-link-active' : 'nav-link')}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAppConfigured && (
              <a
                href={explorerAddress(FACTORY_ADDRESS, botTestnet.id)}
                target="_blank"
                rel="noreferrer"
                className="hidden font-mono text-xs uppercase tracking-wider text-zinc-500 transition hover:text-cyan-300 lg:inline"
                title="Factory on explorer"
              >
                factory {shortAddr(FACTORY_ADDRESS)}
              </a>
            )}
            <span className="chip-live">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Testnet
            </span>
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </div>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto border-t border-white/[0.05] px-3 py-2 md:hidden">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `${isActive ? 'nav-link-active' : 'nav-link'} shrink-0`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {!isAppConfigured ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/25 bg-amber-500/10 px-6 py-12 text-center">
            <p className="font-display text-2xl font-semibold text-amber-100">Coming online</p>
            <p className="mt-3 text-base leading-relaxed text-amber-100/80">
              Spawn.fun is not connected to a factory on this deployment yet. Check back shortly.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <footer className="mt-auto border-t border-white/[0.06] bg-black/40">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Link to="/" className="inline-flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-400 font-mono text-xs font-bold text-black">
                  S
                </span>
                <span className="font-display text-base font-bold tracking-tight">
                  Spawn<span className="text-zinc-500">.fun</span>
                </span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
                Fair-launch memecoins on BOT Chain. Bonding curves, locked AMM, and protocol fees that
                buy back and burn $SPAWN.
              </p>
            </div>

            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Product
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
                <li>
                  <Link to="/" className="transition hover:text-white">
                    Markets
                  </Link>
                </li>
                <li>
                  <Link to="/spawn" className="transition hover:text-white">
                    Launch a token
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className="transition hover:text-white">
                    Creator studio
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Network
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
                <li>
                  <a
                    href="https://scan.bohr.life"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 transition hover:text-white"
                  >
                    Explorer
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://dex.botchain.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 transition hover:text-white"
                  >
                    BDEX
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://rpc.bohr.life"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 transition hover:text-white"
                  >
                    RPC
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Protocol
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
                <li>1.25% trade fee</li>
                <li>50% to creators</li>
                <li>80% protocol → $SPAWN burn</li>
                {isAppConfigured && (
                  <li>
                    <a
                      href={explorerAddress(FACTORY_ADDRESS, botTestnet.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-xs transition hover:text-cyan-300"
                    >
                      Factory {shortAddr(FACTORY_ADDRESS)}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center">
            <p>© {year} Spawn.fun. Built on BOT Chain.</p>
            <p className="font-mono uppercase tracking-[0.12em]">Chain ID 968 · Testnet</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
