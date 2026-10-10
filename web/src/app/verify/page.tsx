"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MediaPolicySummary } from "@/components/MediaPolicySummary";
import { parseSourceDeclaration } from "@/lib/sourceDeclaration";
import Image from "next/image";
import { PageFrame, SectionLabel } from "@/components/shell";
import { sha256Hex } from "@/lib/hash";
import { prepareAsset } from "@/lib/prepareAsset";
import { readBoundedBlob } from "@/lib/assetSafety";
import { readPassportMetadata } from "@/lib/pngMeta";
import { getPassportIdByContentHash, getPassport, findPerceptualMatches, verifyDecision, getTrailLength } from "@/lib/registry";
import { requireDeployment, deploymentInfo } from "@/lib/deployment";
import { Hex } from "viem";

type Outcome = { kind: string; id?: Hex; distance?: number; data?: Record<string, unknown>; hint?: string; trailCount?: string };
const val = (data: Record<string, unknown>, key: string, index: number) => data[key] ?? Object.values(data)[index];

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [hash, setHash] = useState("");
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const verify = async (incoming: File) => {
    setFile(null); setBusy(true); setError(""); setOutcome(null); setHash("");
    try {
      requireDeployment();
      const prepared = await prepareAsset(incoming);
      const file = prepared.file;
      setFile(file);
      const deployedAddress = deploymentInfo.address as string | null;
      let hint = "";
      if (file.type === "image/png") {
        try {
          const meta = readPassportMetadata(await readBoundedBlob(file));
          if (meta) hint = meta.chainId === 10143 && deployedAddress && meta.contract.toLowerCase() === deployedAddress.toLowerCase()
            ? `Embedded record hint: ${meta.passportId.slice(0, 10)}… · unverified metadata.`
            : "Embedded metadata belongs to another chain or contract and was ignored.";
        } catch { hint = "Embedded metadata absent; verifying directly via canonical file hash."; }
      }
      const digest = await sha256Hex(file); setHash(digest);
      const id = await getPassportIdByContentHash(digest as Hex);
      if (!/^0x0{64}$/i.test(id)) {
        const data = await getPassport(id); const revoked = Boolean(val(data, "revoked", 8));
        const kind = verifyDecision({ exact: true, exists: true, revoked });
        const trailCount = (await getTrailLength(id)).toString();
        setOutcome({ kind, id, data, hint, trailCount }); return;
      }
      const matches = prepared.perceptualHash ? await findPerceptualMatches(prepared.perceptualHash, { maxPages: 100 }) : [];
      if (matches[0]) { const data = await getPassport(matches[0].passportId); setOutcome({ kind: "perceptual", id: matches[0].passportId, distance: matches[0].distance, data, hint }); return; }
      setOutcome({ kind: "none", hint });
    } catch (e) { setError(e instanceof Error ? e.message : "Verification RPC is unavailable. Try again shortly."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) void verify(f);
  };

  return <PageFrame>
    <div className="page-heading">
      <SectionLabel>CITIZEN VERIFICATION / 02</SectionLabel>
      <h1>Verify official <span className="purple">publisher media.</span></h1>
      <p>
        Check a photograph, press notice, or release before sharing. Download the file from an announcement or post and compare its canonical cryptographic fingerprint against official registrations on Monad. Confirm whether it was registered by a genuinely verified authority.
      </p>
    </div>

    <div className="workspace">
      <section className="panel">
        <div className="panel-title">
          <h3>Inspect media release</h3>
          <span className="muted" style={{ fontSize: 9 }}>PRIVATE · IN BROWSER</span>
        </div>
        <div className={`dropzone ${drag ? "drag" : ""}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
          {file && file.type.startsWith("image/") ? <Image unoptimized width={1200} height={900} src={preview} alt="Asset selected for verification"/> : <div className="drop-copy">
            <div className="monogram" style={{ margin: "0 auto 10px" }}>⌕</div>
            <strong>{file?.name ?? "Drop official media file to verify"}</strong>
            <span>Exact SHA-256 hash comparison against Monad Issuer Registry</span>
            <div style={{ marginTop: 13 }}>
              <button className="button button-ghost" onClick={() => input.current?.click()}>{file ? "Choose another" : "Browse file"}</button>
            </div>
          </div>}
        </div>
        <input ref={input} className="hidden-file" type="file" onChange={e => e.target.files?.[0] && void verify(e.target.files[0])} aria-label="Choose file to verify"/>
        <div className="meta-row" style={{ marginTop: 14 }}>
          <span>Canonical SHA-256</span>
          <b>{hash ? `${hash.slice(0, 16)}…${hash.slice(-8)}` : "—"}</b>
        </div>
        {busy && <p role="status" className="muted" style={{ fontSize: 11 }}>Comparing against official Monad registry records…</p>}
        {error && <div className="error-box" role="alert">{error}<div style={{ marginTop: 7, fontSize: 10 }}>Verification could not be completed.</div></div>}
        {outcome && <div className="result-card">
          <span className={`result-chip ${outcome.kind === "exact" || outcome.kind === "authentic" ? "auth" : outcome.kind === "revoked" ? "neutral" : outcome.kind === "perceptual" ? "warn" : "bad"}`}>
            {outcome.kind === "exact" || outcome.kind === "authentic" ? "AUTHENTIC PUBLICATION MATCH · VERIFIED PUBLISHER" : outcome.kind === "revoked" ? "REGISTRATION REVOKED" : outcome.kind === "perceptual" ? "MODIFIED RELEASE COPY" : "NO MATCHING OFFICIAL REGISTRATION FOUND"}
          </span>
          <MediaPolicySummary decision={outcome.kind === "revoked" ? "revoked" : outcome.kind === "perceptual" ? "perceptual" : outcome.kind === "none" ? "none" : "exact"} signedTool={outcome.data ? String(val(outcome.data, "tool", 3)) : null} creator={outcome.data ? String(val(outcome.data, "creator", 2)) : null}/>
          {(outcome.kind === "exact" || outcome.kind === "revoked") && outcome.data && <div style={{ marginTop: 16 }}>
            <h3>{outcome.kind === "revoked" ? "Matching release · Registration revoked" : "Authentic Official Release"}</h3>
            <div className="meta-row"><span>Registering Wallet</span><b>{String(val(outcome.data, "creator", 2))}</b></div>
            <div className="meta-row"><span>Declared Source</span><b>{parseSourceDeclaration(String(val(outcome.data, "tool", 3))).source}</b></div>
            <div className="meta-row"><span>Publisher Name</span><b>{parseSourceDeclaration(String(val(outcome.data, "tool", 3))).tool}</b></div>
            <div className="meta-row"><span>Registration Date</span><b>{new Date(Number(val(outcome.data, "createdAt", 5)) * 1000).toLocaleString()}</b></div>
            <div className="meta-row"><span>Lineage Events</span><b>{outcome.trailCount ?? "—"}</b></div>
          </div>}
          {outcome.kind === "perceptual" && <div style={{ marginTop: 14 }}>
            <h3>Modified version of official release</h3>
            <p className="muted" style={{ fontSize: 11 }}>Perceptual similarity distance {outcome.distance} / 64. Indicates a cropped, resized, or re-encoded copy of a registered release.</p>
          </div>}
          {outcome.id && <Link className="button button-ghost" style={{ display: "inline-block", marginTop: 12 }} href={`/p/${outcome.id}`}>View full publication record & history ↗</Link>}
          {outcome.hint && <p className="muted" style={{ fontSize: 9, marginTop: 12, marginBottom: 0 }}>{outcome.hint}</p>}
        </div>}
      </section>

      <aside className="panel">
        <SectionLabel>VERIFICATION PROCESS</SectionLabel>
        <div className="timeline" style={{ marginTop: 20 }}>
          <div className="timeline-item">
            <h4>1. Local SHA-256 Fingerprint</h4>
            <p>Calculates the canonical file hash privately in your browser.</p>
          </div>
          <div className="timeline-item">
            <h4>2. Monad Registry Query</h4>
            <p>Queries Monad smart contracts for registered publications matching the exact file hash.</p>
          </div>
          <div className="timeline-item">
            <h4>3. Issuer Authority Verification</h4>
            <p>Audits the signing wallet against the Trusted Issuer Registry to confirm official government or institutional authority.</p>
          </div>
        </div>
        <div className="divider"/>
        <p className="muted" style={{ fontSize: 10, lineHeight: 1.7 }}>
          Cryptographic evidence guarantees whether a file matches an authorized publisher&apos;s registration.
        </p>
        <Link href="/create" className="button button-primary" style={{ display: "inline-block", marginTop: 4 }}>Register Official Media ↗</Link>
      </aside>
    </div>
  </PageFrame>;
}
