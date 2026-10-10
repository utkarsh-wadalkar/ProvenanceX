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
  ["Register a real asset", "Create a unique variation and register it on testnet."],
  ["Verify the downloaded copy", "Choose the registered PNG you saved and check its embedded media record and live hash."],
  ["Change one pixel", "See exact matching fail and perceptual matching find the record."],
  ["Append the derivative", "Write a real lineage event using the original registration signer."],
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
    const file = new File([toArrayBuffer(bytes)], `demo-${Date.now()}.png`, { type: "image/png" });
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
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `provenancex-${passportId.slice(2, 10)}.png`; anchor.click();
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
        setFeed((old) => [{ label: "Media record registered", tx: result.transactionHash, seconds: (Date.now() - started) / 1000 }, ...old]);
        setStep(1); setStatus("Registration confirmed. Choose the downloaded registered PNG in step 2 to verify that copy.");
      }
      if (n === 2) {
        const candidate = chosenFile ?? downloadedFile;
        if (!candidate || !id || !hash || candidate.type !== "image/png") throw new Error("Choose the PNG downloaded after step 1.");
        const prepared = await prepareAsset(candidate);
        const metadata = readPassportMetadata(await readBoundedBlob(prepared.file));
        const configuredContract = String(deploymentInfo.address ?? "");
        if (!metadata || metadata.passportId.toLowerCase() !== id.toLowerCase() || metadata.chainId !== 10143 || !configuredContract || metadata.contract.toLowerCase() !== configuredContract.toLowerCase()) {
          throw new Error("The selected PNG does not carry this registration’s expected testnet metadata.");
        }
        const selectedHash = await sha256Hex(prepared.file);
        if (selectedHash.toLowerCase() !== hash.toLowerCase()) throw new Error("The selected PNG content differs from the registered asset.");
        const found = await getPassportIdByContentHash(selectedHash);
        if (found.toLowerCase() !== id.toLowerCase()) throw new Error("The live registry did not return the expected media record. No verification result was produced.");
        setFileStatus("exact"); setStep(2); setStatus(`The selected registered PNG matches live registry record ${id.slice(0, 12)}… exactly.`);
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
          changed = new File([blob], "tampered-demo.png", { type: "image/png" });
        } finally { bitmap.close(); }
        const changedHash = await sha256Hex(changed);
        if ((await getPassportIdByContentHash(changedHash)).toLowerCase() !== emptyId) throw new Error("Unexpected exact match for the changed pixels.");
        const changedPrepared = await prepareAsset(changed);
        const matches = await findPerceptualMatches(changedPrepared.perceptualHash, { maxPages: 100 });
        const match = matches.find((entry) => entry.passportId.toLowerCase() === id.toLowerCase());
        if (!match) throw new Error("The live index did not return this media record as a perceptual match.");
        setTamperedFile(changed); setFileStatus("perceptual"); setStep(3); setStatus(`One pixel changed; exact hash differs. Live dHash found media record ${id.slice(0, 12)}… at distance ${match.distance}.`);
      }
      if (n === 4) {
        if (!id || !hash || !signer) throw new Error("Complete the registration step first.");
        const editHash = bytes32KeccakUtf8(`demo-derivative-edit:${hash}:${Date.now()}`);
        let result: { transactionHash: Hex };
        if (signer.mode === "demo-key") {
          result = await appendWithPublicDemoKey(id, "DERIVATIVE_EDIT", editHash, signer.address);
        } else {
          if (!isConnected || !address || address.toLowerCase() !== signer.address.toLowerCase()) throw new Error("Reconnect the wallet used for registration before appending the derivative.");
          result = await appendPassportEvent(id, "DERIVATIVE_EDIT", editHash);
        }
        setFeed((old) => [{ label: "Derivative event appended", tx: result.transactionHash, seconds: (Date.now() - started) / 1000 }, ...old]);
        setStep(4); setStatus("A real derivative event was confirmed using the original registration signer.");
      }
    } catch (error) { setErr(error instanceof Error ? error.message : "Demo action failed."); }
    finally { setBusy(false); }
  }

  function reset() {
    setStep(0); setSourceFile(null); setDownloadedFile(null); setTamperedFile(null); setHash(null); setId(null); setSigner(null); setSignedTool(""); setFileStatus("unverified"); setFeed([]); setStatus(""); setErr("");
    if (input.current) input.current.value = "";
  }

  return <PageFrame><div className="page-heading"><SectionLabel>MEDIA PROVENANCE / GUIDED DEMO</SectionLabel><h1>Check the file, <span className="purple">then the source.</span></h1><p>A real testnet workflow using bundled procedural artwork. It is declared synthetic by the signer; no model or detector is involved.</p></div><WalletNotice/>{id&&signer&&signedTool&&<MediaPolicySummary decision={demoDecisionForFileStatus(fileStatus)} signedTool={signedTool} creator={signer.address}/>}<div className="workspace"><section className="panel"><div className="panel-title"><h3>Walkthrough</h3><button className="small-button" onClick={reset} disabled={busy}>Reset demo</button></div>{steps.map(([title, desc], index) => <button key={title} className={`step-button ${step === index ? "current" : ""}`} onClick={() => index === 1 ? input.current?.click() : void run(index + 1)} disabled={busy || !deploymentInfo.address || (!isConnected && !demoKey) || (index > 0 && step < index)}><span className="n">{index + 1}</span><span>{title}<small>{desc}</small></span></button>)}<input ref={input} className="hidden-file" type="file" accept="image/png,.png" aria-label="Choose the downloaded registered PNG" onChange={(event) => { const chosen = event.currentTarget.files?.[0]; if (!chosen) return; setDownloadedFile(chosen); setTamperedFile(null); setFileStatus("unverified"); setErr(""); void run(2, chosen); }}/>{busy && <p role="status" className="muted" style={{ fontSize: 11 }}>Waiting for RPC and transaction confirmation…</p>}{status && <div className="success-box" style={{ marginTop: 13 }}>{status}</div>}{err && <div className="error-box" role="alert" style={{ marginTop: 13 }}>{err}</div>}<div className="divider"/>{shownFile && preview && <><Image className="asset-preview" src={preview} width={1200} height={900} unoptimized alt={tamperedFile ? "One-pixel changed sample artwork" : downloadedFile ? "Selected downloaded registered media preview" : "Registered sample artwork"}/><div className="meta-row"><span>{tamperedFile ? "Modified file" : downloadedFile ? "Selected PNG" : "Sample artwork"}</span><b>{shownFile.name}</b></div>{id && <Link className="button button-ghost" style={{ display: "inline-block", marginTop: 12 }} href={`/p/${id}`}>Open public media record ↗</Link>}</>}</section><aside className="panel"><SectionLabel>LIVE CHAIN ACTIVITY</SectionLabel><p className="muted" style={{ fontSize: 10, lineHeight: 1.6, marginTop: 11 }}>Confirmed receipts only · elapsed time is measured locally.</p>{feed.length ? feed.map((item, index) => <div key={`${item.tx}-${index}`} className="feed-item"><span>{item.label}<small style={{ display: "block", color: "#777", marginTop: 5 }}>{item.seconds.toFixed(1)} sec</small></span><a target="_blank" rel="noreferrer" href={`https://testnet.monadexplorer.com/tx/${item.tx}`}>Explorer ↗</a></div>) : <div className="dropzone" style={{ minHeight: 110 }}><span className="muted" style={{ fontSize: 10 }}>No transactions yet</span></div>}<div className="divider"/><div className="meta-row"><span>Network</span><b>Monad Testnet · 10143</b></div><div className="meta-row"><span>Registration signer</span><b>{signer ? `${signer.address.slice(0, 7)}… · ${signer.mode}` : "Not registered"}</b></div><a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className="small-button" style={{ display: "inline-block", marginTop: 10 }}>Get test MON ↗</a><p className="muted" style={{ fontSize: 9, lineHeight: 1.6, marginTop: 12 }}>Reset clears this browser walkthrough only. It does not reset or remove on-chain records.</p></aside></div></PageFrame>;
}
