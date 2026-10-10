"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MediaPolicySummary } from "@/components/MediaPolicySummary";
import { parseSourceDeclaration } from "@/lib/sourceDeclaration";
import { useParams, useSearchParams } from "next/navigation";
import type { Hex } from "viem";
import { PageFrame, SectionLabel } from "@/components/shell";
import { getPassport, getChildren, getTrailLength, getTrailPage, getTrailTransactionHashes, isAuthorizedOperator } from "@/lib/registry";
import { verifyTrailEntries, type TrailEntry } from "@/lib/trail";
import { deploymentInfo, requireDeployment } from "@/lib/deployment";
import { fetchSafeAssetPreview } from "@/lib/assetSafety";
import { useAccount } from "wagmi";
import { appendPassportEvent, authorizeOperator, revokePassport } from "@/lib/wallet";
import { sha256Hex } from "@/lib/hash";

const Z = `0x${"0".repeat(64)}`;
const field = (d: Record<string, unknown>, k: string, i: number) => d[k] ?? Object.values(d)[i];

export default function Passport() {
  const { id } = useParams<{ id: string }>();
  const query = useSearchParams();
  const pid = id as Hex;
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [entries, setE] = useState<TrailEntry[]>([]);
  const [links, setL] = useState<{ blockNumber: bigint; transactionHash: Hex }[]>([]);
  const [kids, setK] = useState<Hex[]>([]);
  const [ok, setOk] = useState(false);
  const [img, setImg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [op, setOp] = useState("");
  const [status, setStatus] = useState("");
  const [operatorAllowed, setOperatorAllowed] = useState(false);
  const { address, chainId } = useAccount();

  useEffect(() => {
    let alive = true;
    let previewUrl = "";
    (async () => {
      try {
        requireDeployment();
        if (!/^0x[0-9a-fA-F]{64}$/.test(pid)) throw Error("Invalid media record ID.");
        const p = await getPassport(pid);
        const n = Number(await getTrailLength(pid));
        const all: TrailEntry[] = [];
        for (let x = 0; x < n; x += 200) all.push(...await getTrailPage(pid, x, Math.min(200, n - x)) as TrailEntry[]);
        const proof = verifyTrailEntries(all, String(field(p, "trailHead", 7)) as Hex, n, String(field(p, "contentHash", 0)) as Hex);
        const tx: { blockNumber: bigint; transactionHash: Hex }[] = [];
        for (let x = 0; x < all.length; x += 200) tx.push(...await getTrailTransactionHashes(pid, all.slice(x, x + 200)));
        const children = await getChildren(pid);
        if (!alive) return;
        setD(p); setE(all); setL(tx); setK(children); setOk(proof.valid);
        const local = sessionStorage.getItem(`px:asset:${pid}`);
        if (local) setImg(local);
        else {
          const uri = String(field(p, "metadataURI", 4) || "");
          if (uri) {
            try {
              previewUrl = await fetchSafeAssetPreview(uri) || "";
              if (alive && previewUrl) setImg(previewUrl);
            } catch {}
          }
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Media record unavailable.");
      }
    })();
    return () => {
      alive = false;
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [pid]);

  const owner = !!address && d && String(field(d ?? {}, "creator", 2)).toLowerCase() === address.toLowerCase();

  useEffect(() => {
    let live = true;
    if (!address || chainId !== 10143 || !d || owner) { setOperatorAllowed(false); return; }
    isAuthorizedOperator(pid, address).then(value => { if (live) setOperatorAllowed(value); }).catch(() => { if (live) setOperatorAllowed(false); });
    return () => { live = false; };
  }, [address, chainId, d, owner, pid]);

  const doAction = async (kind: string) => {
    if (!d) return;
    setBusy(true); setErr("");
    try {
      if (kind === "append") {
        if (!note.trim()) throw Error("Enter an event note.");
        await appendPassportEvent(pid, "DERIVATIVE_EDIT", await sha256Hex(new TextEncoder().encode(note)));
      }
      if (kind === "operator") {
        if (!/^0x[0-9a-fA-F]{40}$/.test(op)) throw Error("Enter a valid wallet address.");
        await authorizeOperator(pid, op as `0x${string}`, true);
      }
      if (kind === "revoke") {
        if (!confirm("Revoke this official media record permanently on chain?")) return;
        await revokePassport(pid);
      }
      setStatus("Transaction confirmed on Monad Testnet.");
      location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transaction failed.");
    } finally { setBusy(false); }
  };

  if (query.get("embed") === "1" && (err || !deploymentInfo.address)) return <main style={{ padding: 12, maxWidth: 420 }}><div className="badge-frame" role="status"><div className="monogram">PX</div><div><b>ProvenanceX</b><small>{err || "Contract deployment pending · badge unavailable"}</small></div></div></main>;
  if (query.get("embed") === "1" && d) return <main style={{ padding: 12, maxWidth: 420 }}><Link href={`/p/${pid}`} target="_blank" rel="noreferrer" className="badge-frame">{img ? <Image unoptimized width={70} height={70} src={img} alt=""/> : <div className="monogram">PX</div>}<div><b style={{ fontFamily: "Georgia" }}>ProvenanceX · {Boolean(field(d, "revoked", 8)) ? "REVOKED" : "VERIFIED"}</b><small>{pid.slice(0, 12)}… · {parseSourceDeclaration(String(field(d, "tool", 3))).source.toUpperCase()} · {ok ? "TRAIL VERIFIED" : "CHECKING TRAIL"}</small></div></Link></main>;

  return <PageFrame>
    <div className="page-heading">
      <SectionLabel>OFFICIAL MEDIA RECORD / MONAD TESTNET</SectionLabel>
      <h1>Official publication <span className="purple">record.</span></h1>
      <p>Inspect the registered file hash, verified publisher wallet, signed source declaration, edit history, and on-chain lineage. Compare any downloaded photo or release in Verify to check whether it matches this official record.</p>
    </div>
    {err && <div className="error-box">{err}</div>}
    {!d && !err && <div className="panel">Reading official publication record from Monad registry…</div>}
    {Boolean(d) && <>
      <MediaPolicySummary decision={Boolean(field(d ?? {}, "revoked", 8)) ? "revoked-record" : "record"} signedTool={String(field(d ?? {}, "tool", 3))} creator={String(field(d ?? {}, "creator", 2))}/>
      <div className="workspace">
        <section className="panel">
          {img ? <Image unoptimized width={1200} height={900} className="asset-preview" src={img} alt="Media record artwork"/> : <div className="dropzone"><div className="drop-copy"><strong>Preview unavailable</strong><span>Public record remains verifiable by hash.</span></div></div>}
          <div className="panel-title" style={{ marginTop: 20 }}>
            <h3>Official publication details</h3>
            <span className={`result-chip ${field(d ?? {}, "revoked", 8) ? "neutral" : "auth"}`}>{Boolean(field(d ?? {}, "revoked", 8)) ? "REVOKED" : "VERIFIED RELEASE"}</span>
          </div>
          {[
            ["Publication Record ID", pid],
            ["Publisher Wallet", field(d ?? {}, "creator", 2)],
            ["Publisher / Organization", parseSourceDeclaration(String(field(d ?? {}, "tool", 3))).tool],
            ["Source Attestation", parseSourceDeclaration(String(field(d ?? {}, "tool", 3))).source],
            ["Registration Time", new Date(Number(field(d ?? {}, "createdAt", 5)) * 1000).toLocaleString()],
            ["Canonical SHA-256", field(d ?? {}, "contentHash", 0)],
            ["Hash-Chain Head", field(d ?? {}, "trailHead", 7)],
          ].map(([k, v]) => <div className="meta-row" key={String(k)}><span>{String(k)}</span><b>{String(v)}</b></div>)}
          <div className="divider"/>
          <SectionLabel>HASH-CHAIN AUDIT TRAIL</SectionLabel>
          <p className="trail-proof" style={{ marginTop: 12 }}>{ok ? "✓ Complete cryptographic trail verified against Monad head" : "! Trail verification failed"}</p>
          <div className="timeline" style={{ marginTop: 18 }}>
            {entries.map((e, i) => <article className="timeline-item" key={e.trailHead}>
              <h4>{e.eventType} <span className="muted">· {new Date(Number(e.timestamp) * 1000).toLocaleString()}</span></h4>
              <p>Actor {e.actor} · {e.dataHash.slice(0, 14)}…</p>
              <p>{links[i] ? <a style={{ color: "#bdb1ff" }} href={`https://testnet.monadexplorer.com/tx/${links[i].transactionHash}`} target="_blank" rel="noreferrer">Block {links[i].blockNumber.toString()} · transaction receipt ↗</a> : "Transaction link unavailable"}</p>
            </article>)}
          </div>
          <div className="divider"/>
          <SectionLabel>LINEAGE & DERIVATIVES</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {String(field(d ?? {}, "parentId", 6)).toLowerCase() !== Z && <Link className="small-button" href={`/p/${field(d ?? {}, "parentId", 6)}`}>← Parent official release</Link>}
            {kids.map(c => <Link key={c} className="small-button" href={`/p/${c}`}>Child release {c.slice(0, 10)}… ↗</Link>)}
            {kids.length === 0 && String(field(d ?? {}, "parentId", 6)).toLowerCase() === Z && <span className="muted" style={{ fontSize: 10 }}>No derivative lineage records yet.</span>}
          </div>
        </section>

        <aside style={{ display: "grid", alignContent: "start", gap: 14 }}>
          <div className="panel">
            <SectionLabel>EMBED PUBLISHER BADGE</SectionLabel>
            <div className="badge-frame" style={{ marginTop: 14 }}>
              {img ? <Image unoptimized width={70} height={70} src={img} alt=""/> : <div className="monogram">PX</div>}
              <div><b style={{ fontFamily: "Georgia" }}>ProvenanceX</b><small>{pid.slice(0, 12)}… · {ok ? "VERIFIED PUBLICATION" : "CHECK TRAIL"}</small></div>
            </div>
            <p className="muted" style={{ fontSize: 10, marginTop: 12 }}>Embed this live badge on official portal or news agency pages.</p>
            <textarea className="embed-code" readOnly value={`<iframe src="${typeof location !== "undefined" ? location.origin : ""}/p/${pid}?embed=1" width="360" height="120" title="ProvenanceX official media record"></iframe>`}/>
            <button className="small-button" onClick={() => navigator.clipboard.writeText(`<iframe src="${location.origin}/p/${pid}?embed=1" width="360" height="120" title="ProvenanceX official media record"></iframe>`)}>Copy snippet</button>
          </div>

          <div className="panel">
            <SectionLabel>PUBLISHER CONTROLS</SectionLabel>
            {owner ? <>
              <div className="field"><label htmlFor="note">Append a lineage event</label><input id="note" value={note} onChange={e => setNote(e.target.value)} placeholder="Describe edit or press release update"/></div>
              <button className="button button-primary" disabled={busy || !ok || Boolean(field(d ?? {}, "revoked", 8))} onClick={() => void doAction("append")}>Append event ↗</button>
              <div className="field"><label htmlFor="op">Authorize an operator</label><input id="op" value={op} onChange={e => setOp(e.target.value)} placeholder="0x…"/></div>
              <button className="button button-ghost" disabled={busy || Boolean(field(d ?? {}, "revoked", 8))} onClick={() => void doAction("operator")}>Authorize operator ↗</button>
              <button className="button button-ghost" style={{ marginTop: 8, color: "#ffaaa0" }} disabled={busy || Boolean(field(d ?? {}, "revoked", 8))} onClick={() => void doAction("revoke")}>Revoke registration</button>
            </> : <p className="muted" style={{ fontSize: 10, lineHeight: 1.7 }}>Connect authorized publisher wallet on Monad Testnet to manage this release.</p>}
            {status && <div className="success-box">{status}</div>}
            {err && <div className="error-box">{err}</div>}
          </div>

          {operatorAllowed && !owner && <div className="panel">
            <SectionLabel>AUTHORIZED OPERATOR</SectionLabel>
            <div className="field"><label htmlFor="operator-note">Append a lineage event</label><input id="operator-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Describe edit or press release update"/></div>
            <button className="button button-primary" disabled={busy || !ok || Boolean(field(d ?? {}, "revoked", 8))} onClick={() => void doAction("append")}>Append event ↗</button>
          </div>}
        </aside>
      </div>
    </>}
  </PageFrame>;
}
