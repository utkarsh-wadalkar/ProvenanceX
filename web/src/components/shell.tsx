"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi";
import { monadTestnet, TESTNET_FAUCET_URL } from "@/lib/chain";
import { ensureMonadTestnet } from "@/lib/wallet";
import { deploymentInfo } from "@/lib/deployment";

export function Header() {
  const path = usePathname(); const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending, error: connectionError } = useConnect(); const { disconnect } = useDisconnect(); const [switching,setSwitching]=useState(false); const [switchError,setSwitchError]=useState(""); const [walletError,setWalletError]=useState("");
  const connectMessage = walletError || (connectionError ? /reject|denied|cancel/i.test(connectionError.message) ? "Wallet connection was cancelled." : /connector|provider|ethereum/i.test(connectionError.message) ? "No compatible wallet was found. Install MetaMask or another EIP-1193 wallet, then reload." : "Wallet connection failed. Check your wallet and try again." : "");
  const { data: balance } = useBalance({ address, chainId: 10143, query: { enabled: !!address && chainId === 10143 } });
  const links = [["Overview", "/"], ["Register Media", "/create"], ["Verify Publisher", "/verify"], ["Publisher Demo", "/demo"]];
  return <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">P<span>.</span></span><span>provenance<span className="brand-muted">x</span><small>VERIFIED PUBLISHER REGISTRY</small></span></Link>
    <nav aria-label="Main navigation">{links.map(([name, href]) => <Link key={href} href={href} className={path === href || (href === "/" && path.startsWith("/p/")) ? "nav-link active" : "nav-link"}>{name}</Link>)}</nav>
    <div className="wallet-area">{isConnected ? <><span className="wallet-pill"><i className={chainId === 10143 ? "dot live" : "dot"}/>{chainId === 10143 ? `${address?.slice(0, 5)}…${address?.slice(-4)} · ${balance ? Number(balance.formatted).toFixed(2) : "—"} MON` : "Wrong network"}</span>{chainId !== 10143 && <button className="small-button" onClick={async () => {setSwitching(true);setSwitchError("");try{await ensureMonadTestnet()}catch{setSwitchError("Switch your wallet to Monad Testnet (chain 10143), then try again.")}finally{setSwitching(false)}}} disabled={switching}>{switching ? "Switching…" : "Switch network"}</button>}<button className="icon-button" onClick={() => disconnect()} aria-label="Disconnect wallet">↗</button></> : <button className="button button-light connect" disabled={isPending} onClick={() => { setWalletError(""); if (!connectors[0]) { setWalletError("No injected wallet found. Install MetaMask or another EIP-1193 wallet, then reload."); return; } try { connect({ connector: connectors[0], chainId: monadTestnet.id }); } catch { setWalletError("Wallet connection failed. Check your wallet and try again."); } }}>{isPending ? "Connecting…" : "Connect wallet"}</button>}{(switchError || connectMessage) && <span role="alert" className="wallet-error">{switchError || connectMessage}</span>}</div>
    <div className="mobile-status">{!deploymentInfo.address ? <span>TESTNET · CONTRACT PENDING</span> : <a href={TESTNET_FAUCET_URL} target="_blank" rel="noreferrer">Need test MON?</a>}</div>
  </header>
}
export function Footer() { return <footer className="footer"><span>PROVENANCEX <b>·</b> VERIFY THE SOURCE, NOT JUST THE CONTENT</span><span>MONAD TESTNET <b>·</b> CHAIN 10143 · {deploymentInfo.address?"CONTRACT LIVE":"DEPLOYMENT PENDING"}</span><a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">Get test MON ↗</a></footer> }

export function PageFrame({ children }: { children: React.ReactNode }) { return <><Header/><main>{children}</main><Footer/></> }
export function SectionLabel({ children }: { children: React.ReactNode }) { return <span className="eyebrow"><i/> {children}</span> }
export function WalletNotice() { const { isConnected, chainId }=useAccount(); return <>{isConnected && chainId !== 10143 && <div className="notice warn">Switch to Monad Testnet (10143) to continue.</div>}{!deploymentInfo.address && <div className="notice"><span className="status-dot"/> Contract deployment is pending. You can explore the product; on-chain actions will unlock after deployment.</div>}</> }




