"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";
import type { Address, Hex } from "viem";
import { PageFrame, SectionLabel, WalletNotice } from "@/components/shell";
import { deploymentInfo, requireDeployment } from "@/lib/deployment";
import { sha256Hex, bytes32KeccakUtf8 } from "@/lib/hash";
import { findPerceptualMatches, getPassportIdByContentHash } from "@/lib/registry";
import { prepareAsset } from "@/lib/prepareAsset";
import { assertByteLimit, decodeSafeImage, MAX_ASSET_BYTES, readBoundedResponse, readBoundedBlob, toArrayBuffer } from "@/lib/assetSafety";
import { readPassportMetadata, writePassportMetadata } from "@/lib/pngMeta";
import { createDemoRegistrationInput, demoDecisionForFileStatus, type DemoFileStatus } from "@/lib/demoRegistration";
import { MediaPolicySummary } from "@/components/MediaPolicySummary";
import { appendPassportEvent, appendWithPublicDemoKey, registerPassport, registerWithPublicDemoKey } from "@/lib/wallet";

type Feed = { label: string; tx: Hex; seconds: number };
type Signer = { mode: "wallet" | "demo-key"; address: Address };
const sample = "/samples/planet.png";
const emptyId = `0x${"0".repeat(64)}`;
const steps = [
  ["1. Government Official Registers Release", "Simulate an official department wallet registering an official photograph on Monad Testnet."],
  ["2. Citizen Verifies Downloaded Release", "Select the downloaded signed PNG file and confirm its authentic registration and signing wallet."],
  ["3. Detect Unauthorized Pixel Alterations", "Change one pixel to observe how exact hash matching flags modified copies."],
  ["4. Append Official Lineage Update", "Record an official update or derivative event on Monad using the authorized publisher wallet."],
];

export default function Demo() {
  const [step, setStep] = useState(0);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<File | null>(null);
  const [tamperedFile, setTamperedFile] = useState<File | null>(null);
  const [id, setId] = useState<Hex | null>(null);
  const [hash, setHash] = useState<Hex | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [signedTool, setSignedTool] = useState("");
  const [fileStatus, setFileStatus] = useState<DemoFileStatus>("unverified");
  const [feed, setFeed] = useState<Feed[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { address, isConnected } = useAccount();
  const demoKey = !!process.env.NEXT_PUBLIC_DEMO_KEY;

  const shownFile = tamperedFile ?? downloadedFile ?? sourceFile;
  useEffect(() => {
    if (!shownFile) { setPreview(""); return; }
    const url = URL.createObjectURL(shownFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [shownFile]);

  async function createUniqueSample() {
    const response = await fetch(sample, { signal: AbortSignal.timeout(8000) });
    if (!response.ok || !(response.headers.get("content-type") || "").startsWith("image/png")) throw new Error("Bundled sample could not be loaded safely.");
    const bytes = await readBoundedResponse(response, MAX_ASSET_BYTES, "Sample image");
    const file = new File([toArrayBuffer(bytes)], `official-release-${Date.now()}.png`, { type: "image/png" });
    const prepared = await prepareAsset(file);
    const bitmap = await decodeSafeImage(prepared.file);
    try {
      const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable.");
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const random = crypto.getRandomValues(new Uint8Array(4));
      const offset = ((random[0] % canvas.height) * canvas.width + (random[1] % canvas.width)) * 4;
      pixels.data[offset] = (pixels.data[offset] + random[2] + 17) % 256;
      pixels.data[offset + 1] = (pixels.data[offset + 1] + random[3] + 29) % 256;
      context.putImageData(pixels, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG encoding failed.")), "image/png"));
      assertByteLimit(blob.size, MAX_ASSET_BYTES, "Generated image");
      const result = await prepareAsset(new File([blob], file.name, { type: "image/png" }));
      return { file: result.file, hash: await sha256Hex(result.file), phash: result.perceptualHash };
    } finally { bitmap.close(); }
  }

  function downloadPassportPng(file: File, passportId: Hex) {
    if (file.type !== "image/png") throw new Error("The demo media record download requires a registered PNG.");
    const contract = requireDeployment();
    return readBoundedBlob(file).then((bytes) => {
      const output = writePassportMetadata(bytes, { passportId, contract, chainId: 10143 });
      const download = new Blob([toArrayBuffer(output)], { type: "image/png" });
      assertByteLimit(download.size, MAX_ASSET_BYTES, "Registered PNG");
      const url = URL.createObjectURL(download);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `provenancex-official-${passportId.slice(2, 10)}.png`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  async function run(n: number, chosenFile?: File) {
    setErr(""); setStatus(""); setBusy(true); const started = Date.now();
    if (n === 2) setFileStatus("unverified");
    try {
      requireDeployment();
      if (n === 1) {
        const asset = await createUniqueSample();
        const mode = isConnected && address ? "wallet" : "demo-key";
        if (mode === "demo-key" && !demoKey) throw new Error("Connect a wallet or configure the public testnet demo key.");
        const registration = createDemoRegistrationInput({ contentHash: asset.hash, perceptualHash: asset.phash });
        const result = mode === "wallet"
          ? await registerPassport(registration)
          : await registerWithPublicDemoKey(registration);
        setSourceFile(asset.file); setHash(asset.hash); setId(result.passportId); setSigner({ mode, address: mode === "wallet" ? address! : result.signerAddress }); setSignedTool(registration.tool); setFileStatus("registered");
        await downloadPassportPng(asset.file, result.passportId);
        setFeed((old) => [{ label: "Official publication registered", tx: result.transactionHash, seconds: (Date.now() - started) / 1000 }, ...old]);
        setStep(1); setStatus("Official release registration confirmed on Monad. Choose the downloaded PNG in step 2 to verify its authenticity.");
      }
      if (n === 2) {
        const candidate = chosenFile ?? downloadedFile;
        if (!candidate || !id || !hash || candidate.type !== "image/png") throw new Error("Choose the official PNG downloaded after step 1.");
        const prepared = await prepareAsset(candidate);
        const metadata = readPassportMetadata(await readBoundedBlob(prepared.file));
        const configuredContract = String(deploymentInfo.address ?? "");
        if (!metadata || metadata.passportId.toLowerCase() !== id.toLowerCase() || metadata.chainId !== 10143 || !configuredContract || metadata.contract.toLowerCase() !== configuredContract.toLowerCase()) {
          throw new Error("The selected PNG does not carry this official registration's expected testnet metadata.");
        }
        const selectedHash = await sha256Hex(prepared.file);
        if (selectedHash.toLowerCase() !== hash.toLowerCase()) throw new Error("The selected PNG content differs from the registered official publication.");
        const found = await getPassportIdByContentHash(selectedHash);
        if (found.toLowerCase() !== id.toLowerCase()) throw new Error("The live registry did not return the expected publication record.");
        setFileStatus("exact"); setStep(2); setStatus(`Verification confirmed! The selected file matches registered official publication ${id.slice(0, 12)}… exactly.`);
      }
      if (n === 3) {
        if (!downloadedFile || !id) throw new Error("Complete step 2 first.");
        const prepared = await prepareAsset(downloadedFile);
        const bitmap = await decodeSafeImage(prepared.file);
        let changed: File;
        try {
          const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
          const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas is unavailable.");
          context.drawImage(bitmap, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height); const index = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4;
          pixels.data[index] = (pixels.data[index] + 37) % 256; context.putImageData(pixels, 0, 0);
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG encoding failed.")), "image/png"));
          assertByteLimit(blob.size, MAX_ASSET_BYTES, "Changed image");
          changed = new File([blob], "tampered-release.png", { type: "image/png" });
        } finally { bitmap.close(); }
        const changedHash = await sha256Hex(changed);
        if ((await getPassportIdByContentHash(changedHash)).toLowerCase() !== emptyId) throw new Error("Unexpected exact match for the modified pixels.");
        const changedPrepared = await prepareAsset(changed);
        const matches = await findPerceptualMatches(changedPrepared.perceptualHash, { maxPages: 100 });
        const match = matches.find((entry) => entry.passportId.toLowerCase() === id.toLowerCase());
        if (!match) throw new Error("The live index did not return this media record as a perceptual match.");
        setTamperedFile(changed); setFileStatus("perceptual"); setStep(3); setStatus(`Pixel alteration detected! Exact hash check flagged modifications, while perceptual dHash linked it back to official publication ${id.slice(0, 12)}… at distance ${match.distance}.`);
      }
      if (n === 4) {
        if (!id || !hash || !signer) throw new Error("Complete official registration step first.");
        const editHash = bytes32KeccakUtf8(`official-update-event:${hash}:${Date.now()}`);
        let result: { transactionHash: Hex };
        if (signer.mode === "demo-key") {
          result = await appendWithPublicDemoKey(id, "OFFICIAL_UPDATE", editHash, signer.address);
        } else {
          if (!isConnected || !address || address.toLowerCase() !== signer.address.toLowerCase()) throw new Error("Reconnect the authorized publisher wallet before appending official updates.");
          result = await appendPassportEvent(id, "OFFICIAL_UPDATE", editHash);
        }
        setFeed((old) => [{ label: "Official lineage event appended", tx: result.transactionHash, seconds: (Date.now() - started) / 1000 }, ...old]);
        setStep(4); setStatus("An official lineage update event was confirmed using the authorized publisher wallet on Monad.");
      }
    } catch (error) { setErr(error instanceof Error ? error.message : "Demo action failed."); }
    finally { setBusy(false); }
  }

  function reset() {
    setStep(0); setSourceFile(null); setDownloadedFile(null); setTamperedFile(null); setHash(null); setId(null); setSigner(null); setSignedTool(""); setFileStatus("unverified"); setFeed([]); setStatus(""); setErr("");
    if (input.current) input.current.value = "";
  }

  return <PageFrame>
    <div className="page-heading">
      <SectionLabel>VERIFIED PUBLISHER DEMO</SectionLabel>
      <h1>Verify the source, <span className="purple">step by step.</span></h1>
      <p>A guided interactive walkthrough demonstrating official government media registration, citizen verification, edit detection, and immutable on-chain lineage on Monad.</p>
    </div>
    <WalletNotice/>
    {id && signer && signedTool && <MediaPolicySummary decision={demoDecisionForFileStatus(fileStatus)} signedTool={signedTool} creator={signer.address}/>}
    <div className="workspace">
      <section className="panel">
        <div className="panel-title">
          <h3>Publisher & Citizen Walkthrough</h3>
          <button className="small-button" onClick={reset} disabled={busy}>Reset demo</button>
        </div>
        {steps.map(([title, desc], index) => <button key={title} className={`step-button ${step === index ? "current" : ""}`} onClick={() => index === 1 ? input.current?.click() : void run(index + 1)} disabled={busy || !deploymentInfo.address || (!isConnected && !demoKey) || (index > 0 && step < index)}>
          <span className="n">{index + 1}</span>
          <span>{title}<small>{desc}</small></span>
        </button>)}
        <input ref={input} className="hidden-file" type="file" accept="image/png,.png" aria-label="Choose downloaded official release PNG" onChange={(event) => { const chosen = event.currentTarget.files?.[0]; if (!chosen) return; setDownloadedFile(chosen); setTamperedFile(null); setFileStatus("unverified"); setErr(""); void run(2, chosen); }}/>
        {busy && <p role="status" className="muted" style={{ fontSize: 11 }}>Communicating with Monad Testnet smart contract…</p>}
        {status && <div className="success-box" style={{ marginTop: 13 }}>{status}</div>}
        {err && <div className="error-box" role="alert" style={{ marginTop: 13 }}>{err}</div>}
        <div className="divider"/>
        {shownFile && preview && <>
          <Image className="asset-preview" src={preview} width={1200} height={900} unoptimized alt={tamperedFile ? "Modified official release image" : downloadedFile ? "Downloaded official release image" : "Registered official release image"}/>
          <div className="meta-row">
            <span>{tamperedFile ? "Modified file copy" : downloadedFile ? "Downloaded PNG release" : "Official registered image"}</span>
            <b>{shownFile.name}</b>
          </div>
          {id && <Link className="button button-ghost" style={{ display: "inline-block", marginTop: 12 }} href={`/p/${id}`}>Open public media record on Monad ↗</Link>}
        </>}
      </section>

      <aside className="panel">
        <SectionLabel>MONAD TESTNET ACTIVITY</SectionLabel>
        <p className="muted" style={{ fontSize: 10, lineHeight: 1.6, marginTop: 11 }}>Confirmed receipts · Monad sub-second finality.</p>
        {feed.length ? feed.map((item, index) => <div key={`${item.tx}-${index}`} className="feed-item">
          <span>{item.label}<small style={{ display: "block", color: "#777", marginTop: 5 }}>{item.seconds.toFixed(1)} sec</small></span>
          <a target="_blank" rel="noreferrer" href={`https://testnet.monadexplorer.com/tx/${item.tx}`}>Explorer ↗</a>
        </div>) : <div className="dropzone" style={{ minHeight: 110 }}><span className="muted" style={{ fontSize: 10 }}>No transactions yet</span></div>}
        <div className="divider"/>
        <div className="meta-row"><span>Network</span><b>Monad Testnet · 10143</b></div>
        <div className="meta-row"><span>Publisher wallet</span><b>{signer ? `${signer.address.slice(0, 7)}… · ${signer.mode}` : "Not registered"}</b></div>
        <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className="small-button" style={{ display: "inline-block", marginTop: 10 }}>Get test MON ↗</a>
      </aside>
    </div>
  </PageFrame>;
}
