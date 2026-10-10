"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PageFrame, SectionLabel, WalletNotice } from "@/components/shell";
import { deploymentInfo, requireDeployment } from "@/lib/deployment";
import { sha256Hex } from "@/lib/hash";
import { prepareAsset } from "@/lib/prepareAsset";
import { writePassportMetadata } from "@/lib/pngMeta";
import { registerPassport, registerWithPublicDemoKey } from "@/lib/wallet";
import { useAccount } from "wagmi";
import type { Hex } from "viem";
import QRCode from "qrcode";
import { assertByteLimit, decodeSafeImage, fetchBoundedResource, MAX_ASSET_BYTES, readBoundedBlob, readBoundedResponse, readImageDimensions, toArrayBuffer } from "@/lib/assetSafety";
import { buildDeclaredTool, MAX_SIGNED_TOOL_BYTES, type SourceType } from "@/lib/sourceDeclaration";

const samples = [
  { src: "/samples/planet.png", name: "Official Public Notice" },
  { src: "/samples/monolith.png", name: "Disaster Advisory Release" },
  { src: "/samples/crystal.png", name: "Press Release Photograph" },
];

function fileFromBlob(blob: Blob, name: string) { return new File([blob], name, { type: blob.type || "image/png" }); }

export default function CreatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [hash, setHash] = useState<Hex | null>(null);
  const [phash, setPhash] = useState(0n);
  const [tool, setTool] = useState("Department of Public Safety");
  const [metadataURI, setMetadataURI] = useState("");
  const [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passportId, setPassportId] = useState<Hex | null>(null);
  const [tx, setTx] = useState<Hex | null>(null);
  const [qr, setQr] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [drag, setDrag] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("captured");

  const input = useRef<HTMLInputElement>(null);
  const { isConnected } = useAccount();

  const processFile = useCallback(async (f: File) => {
    setError("");
    setMessage("Computing SHA-256 fingerprint in your browser…");
    try {
      const prepared = await prepareAsset(f);
      const digest = await sha256Hex(prepared.file);
      setFile(prepared.file);
      setHash(digest);
      setPhash(prepared.perceptualHash);
      setPreview(URL.createObjectURL(prepared.file));
      setPassportId(null);
      setMessage("File fingerprint ready. Signed registration will link to your wallet.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process this file.");
      setMessage("");
    }
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const generate = async (src: string) => {
    setSourceType("captured");
    setError("");
    setBusy(true);
    try {
      const response = await fetch(src, { signal: AbortSignal.timeout(8000) });
      if (!response.ok || !(response.headers.get("content-type") || "").startsWith("image/")) throw new Error("Sample media could not load safely.");
      const bytes = await readBoundedResponse(response, MAX_ASSET_BYTES, "Sample image");
      const type = (response.headers.get("content-type") || "image/png").split(";", 1)[0];
      const source = fileFromBlob(new Blob([toArrayBuffer(bytes)], { type }), "official-sample.png");
      const prepared = await prepareAsset(source);
      const bitmap = await decodeSafeImage(prepared.file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const c = canvas.getContext("2d");
      if (!c) throw new Error("Canvas is unavailable.");
      c.drawImage(bitmap, 0, 0);
      bitmap.close();
      const px = c.getImageData(0, 0, canvas.width, canvas.height);
      const seed = crypto.getRandomValues(new Uint8Array(8));
      const x = seed[0] % canvas.width, y = seed[1] % canvas.height;
      const i = (y * canvas.width + x) * 4;
      px.data[i] = (px.data[i] + seed[2] + 17) % 256;
      px.data[i + 1] = (px.data[i + 1] + seed[3] + 31) % 256;
      px.data[i + 2] = (px.data[i + 2] + seed[4] + 53) % 256;
      c.putImageData(px, 0, 0);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("PNG encoding failed.")), "image/png"));
      assertByteLimit(png.size, MAX_ASSET_BYTES, "Generated sample");
      const unique = fileFromBlob(png, `official-release-${Date.now()}.png`);
      await processFile(unique);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Could not load sample."} You can upload an image instead.`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!file || !hash) return;
    setError(""); setBusy(true); setMessage("Waiting for wallet signature…");
    const started = Date.now();
    try {
      const contract = requireDeployment();
      if (parent.trim() && !/^0x[0-9a-fA-F]{64}$/.test(parent.trim())) throw new Error("Source record ID must be 32-byte hex.");
      const inputData = { contentHash: hash, perceptualHash: phash, tool: buildDeclaredTool(sourceType, tool.trim() || "Official Publisher"), metadataURI: metadataURI.trim(), ...(parent.trim() ? { parentId: parent.trim() as Hex } : {}) };
      const result = isConnected ? await registerPassport(inputData) : await registerWithPublicDemoKey(inputData);
      setElapsed(Date.now() - started);
      setPassportId(result.passportId);
      setTx(result.transactionHash);
      setMessage("Transaction confirmed. Official publication record is live on Monad.");
      const url = `${location.origin}/p/${result.passportId}`;
      setQr(await QRCode.toDataURL(url, { width: 180, margin: 0, color: { dark: "#17151c", light: "#ffffff" } }));
      sessionStorage.setItem(`px:asset:${result.passportId}`, URL.createObjectURL(file));
      sessionStorage.setItem(`px:hash:${result.passportId}`, hash);
      try {
        if (file.type === "image/png") {
          const bytes = await readBoundedBlob(file);
          const output = writePassportMetadata(bytes, { passportId: result.passportId, contract, chainId: 10143 });
          const packaged = new File([output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer], file.name, { type: "image/png" });
          sessionStorage.setItem("px:download", URL.createObjectURL(packaged));
        } else sessionStorage.setItem("px:download", URL.createObjectURL(file));
      } catch { sessionStorage.setItem("px:download", URL.createObjectURL(file)); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed. Check your wallet and try again.");
      setMessage("");
    } finally {
      setBusy(false);
    }
  };

  const generateLive = async () => {
    setBusy(true); setError("");
    try {
      const result = await fetchBoundedResource("https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85", { maximum: MAX_ASSET_BYTES, timeoutMs: 8000, label: "Live sample", allowedTypes: ["image/jpeg", "image/png", "image/webp"] });
      readImageDimensions(result.bytes, result.contentType);
      await processFile(fileFromBlob(new Blob([toArrayBuffer(result.bytes)], { type: result.contentType }), `official-photo-${Date.now()}.${result.contentType === "image/jpeg" ? "jpg" : "png"}`));
    } catch {
      await generate("/samples/planet.png");
      setError("Live image sample could not be reached safely. Loaded a bundled official sample instead.");
    } finally { setBusy(false); }
  };

  const download = () => {
    const url = sessionStorage.getItem("px:download");
    if (!url || !file) return;
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
  };

  return <PageFrame>
    <div className="page-heading">
      <SectionLabel>OFFICIAL MEDIA REGISTRATION / 01</SectionLabel>
      <h1>Register official <span className="purple">media releases.</span></h1>
      <p>
        Register official photographs, disaster announcements, press releases, or news media. Compute the cryptographic hash locally in your browser and register it on Monad Testnet using an authorized publisher wallet. Citizens can independently verify authentic publications against this record.
      </p>
    </div>
    <WalletNotice/>
    <div className="workspace">
      <section className="panel">
        <div className="panel-title">
          <h3>01 &nbsp; Prepare media asset</h3>
          <span className="muted" style={{ fontSize: 10 }}>LOCAL · PRIVATE</span>
        </div>
        <div className={`dropzone ${drag ? "drag" : ""}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void processFile(f); }}>
          {preview ? <Image unoptimized width={1200} height={900} src={preview} alt="Selected official asset preview"/> : <div className="drop-copy">
            <div className="monogram" style={{ margin: "0 auto 10px" }}>↑</div>
            <strong>Drop official photo, release, or file here</strong>
            <span>Generates exact SHA-256 hash & visual similarity fingerprint locally.</span>
            <div style={{ marginTop: 13 }}>
              <button className="button button-ghost" onClick={() => input.current?.click()}>Browse files</button>
            </div>
          </div>}
        </div>
        <input ref={input} className="hidden-file" type="file" aria-label="Choose media to register" onChange={e => e.target.files?.[0] && void processFile(e.target.files[0])}/>
        {preview && <div className="button-row" style={{ marginTop: 10 }}>
          <button className="small-button" onClick={() => input.current?.click()}>Replace file</button>
          <span className="muted" style={{ fontSize: 10 }}>{file?.name}</span>
        </div>}
        <div className="divider"/>
        <div className="panel-title">
          <h3>Or start with a sample release</h3>
          <button className="small-button" onClick={() => void generateLive()} disabled={busy}>Load live sample release ↗</button>
        </div>
        <span className="muted" style={{ display: "block", fontSize: 9, marginBottom: 10 }}>REMOTE SAMPLE · SAFE LOCAL FALLBACK</span>
        <div className="sample-grid">
          {samples.map(s => <button className="sample" key={s.src} onClick={() => void generate(s.src)} disabled={busy}>
            <Image unoptimized width={1200} height={900} src={s.src} alt=""/>
            <span>{s.name}</span>
          </button>)}
        </div>
        <p className="muted" style={{ fontSize: 10, marginTop: 10, marginBottom: 0 }}>Sample releases receive unique pixel variation signatures for testing.</p>
      </section>

      <aside className="panel">
        <div className="panel-title">
          <h3>02 &nbsp; Publisher details</h3>
          <span className="purple" style={{ fontSize: 9 }}>MONAD TESTNET</span>
        </div>
        <div className="field">
          <label htmlFor="source-type">Source declaration · Publisher attestation</label>
          <select id="source-type" value={sourceType} onChange={e => setSourceType(e.target.value as SourceType)}>
            <option value="captured">Official capture / Official photograph</option>
            <option value="synthetic">Synthetic / AI-assisted media</option>
            <option value="edited">Edited official release</option>
            <option value="unknown">Source declared by publisher</option>
          </select>
          <small>Signed by your wallet and stored immutably on Monad.</small>
        </div>
        <div className="field">
          <label htmlFor="tool">Publisher or organization name</label>
          <input id="tool" value={tool} onChange={e => setTool(e.target.value)} maxLength={96} placeholder="Department of Public Safety / Newsroom / Agency"/>
          <small>Signed field: [{sourceType}] {tool.trim() || "Official Publisher"}</small>
        </div>
        <div className="field">
          <label htmlFor="metadata-uri">Metadata URI <span className="muted">· optional</span></label>
          <input id="metadata-uri" value={metadataURI} onChange={e => setMetadataURI(e.target.value)} placeholder="https://… or ipfs://…" maxLength={512}/>
          <small>Optional public link to official release metadata, press statement, or IPFS file.</small>
        </div>
        <div className="field">
          <label htmlFor="parent">Related official record ID <span className="muted">· optional</span></label>
          <input id="parent" value={parent} onChange={e => setParent(e.target.value)} placeholder="0x…"/>
          <small>Link this release to a parent announcement or original photograph.</small>
        </div>
        <div className="divider"/>
        <div className="meta-row"><span>Canonical SHA-256</span><b>{hash ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : "Waiting for file"}</b></div>
        <div className="meta-row"><span>Perceptual hash</span><b>{hash ? `0x${phash.toString(16).padStart(16, "0")}` : "—"}</b></div>
        <p className="muted" style={{ fontSize: 10, lineHeight: 1.6 }}>Publisher identity is tied to your signing wallet on Monad. The file hash guarantees content integrity.</p>
        <button className="button button-primary" style={{ width: "100%", marginTop: 8 }} disabled={!file || busy || !deploymentInfo.address || (!isConnected && !process.env.NEXT_PUBLIC_DEMO_KEY)} onClick={() => void submit()}>
          {busy ? "Working…" : isConnected ? "Sign & register official release ↗" : process.env.NEXT_PUBLIC_DEMO_KEY ? "Register with demo publisher wallet ↗" : "Connect publisher wallet to register"}
        </button>
        {!isConnected && process.env.NEXT_PUBLIC_DEMO_KEY && <p className="muted" style={{ fontSize: 9, lineHeight: 1.6 }}>Testnet-only demo publisher wallet enabled.</p>}
        <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 10, color: "#aaa", marginTop: 12 }}>Need test MON? Open faucet ↗</a>
        {message && <p className="muted" role="status" style={{ fontSize: 10, marginTop: 14 }}>{message}</p>}
        {error && <div className="error-box" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        {passportId && <div className="certificate" style={{ marginTop: 16 }}>
          <SectionLabel>CONFIRMED · {elapsed ? `${(elapsed / 1000).toFixed(1)} SEC` : ""}</SectionLabel>
          <h3 style={{ margin: "14px 0 8px" }}>Official Release Registered.</h3>
          <div className="cert-number">{passportId}</div>
          <div className="divider"/>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {qr && <Image unoptimized width={1200} height={900} className="qr" src={qr} alt="QR code to view this media record"/>}
            <div>
              <Link className="button button-ghost" href={`/p/${passportId}`}>View public record ↗</Link>
              {tx && <a href={`https://testnet.monadexplorer.com/tx/${tx}`} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 9, color: "#aaa", marginTop: 10 }}>View confirmed transaction ↗</a>}
              <button className="small-button" onClick={download} style={{ marginTop: 8 }}>Download signed PNG file ↓</button>
            </div>
          </div>
        </div>}
      </aside>
    </div>
  </PageFrame>;
}
