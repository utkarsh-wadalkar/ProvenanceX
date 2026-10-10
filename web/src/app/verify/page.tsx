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
type Outcome={kind:string;id?:Hex;distance?:number;data?:Record<string,unknown>;hint?:string;trailCount?:string};
const val=(data:Record<string,unknown>,key:string,index:number)=>data[key]??Object.values(data)[index];
export default function VerifyPage(){const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[outcome,setOutcome]=useState<Outcome|null>(null),[hash,setHash]=useState(""),[drag,setDrag]=useState(false),[preview,setPreview]=useState("");const input=useRef<HTMLInputElement>(null);
 const verify=async (incoming: File) => {
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
      ? `Embedded passport hint: ${meta.passportId.slice(0, 10)}… · treated as untrusted metadata.`
      : "Embedded metadata belongs to a different chain or contract and was ignored.";
    } catch { hint = "Embedded metadata could not be read; verifying by file hash."; }
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
 }; useEffect(()=>{if(!file){setPreview("");return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 const onDrop=(e:React.DragEvent)=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)void verify(f)};
 return <PageFrame><div className="page-heading"><SectionLabel>MEDIA VERIFICATION / VERIFY / 02</SectionLabel><h1>Proof, meet <span className="purple">file.</span></h1><p>Check a photo, video, or file before you share it. Compare it with a registered original and inspect the signed source declaration. PNG metadata helps locate a passport; the file hash provides the exact comparison.</p></div><div className="workspace"><section className="panel"><div className="panel-title"><h3>Inspect media from a post</h3><span className="muted" style={{fontSize:9}}>PRIVATE · IN BROWSER</span></div><div className={`dropzone ${drag?"drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}>{file&&file.type.startsWith("image/")?<Image unoptimized width={1200} height={900} src={preview} alt="Asset selected for verification"/>:<div className="drop-copy"><div className="monogram" style={{margin:"0 auto 10px"}}>⌕</div><strong>{file?.name??"Drop any file to inspect"}</strong><span>Exact hash first · perceptual image match second</span><div style={{marginTop:13}}><button className="button button-ghost" onClick={()=>input.current?.click()}>{file?"Choose another":"Browse file"}</button></div></div>}</div><input ref={input} className="hidden-file" type="file" onChange={e=>e.target.files?.[0]&&void verify(e.target.files[0])} aria-label="Choose file to verify"/><div className="meta-row" style={{marginTop:14}}><span>Canonical SHA-256</span><b>{hash?`${hash.slice(0,16)}…${hash.slice(-8)}`:"—"}</b></div>{busy&&<p role="status" className="muted" style={{fontSize:11}}>Comparing against Monad Testnet records…</p>}{error&&<div className="error-box" role="alert">{error}<div style={{marginTop:7,fontSize:10}}>Verification could not be completed. No authenticity result was produced.</div></div>}{outcome&&<div className="result-card"><span className={`result-chip ${outcome.kind==="exact"||outcome.kind==="authentic"?"auth":outcome.kind==="revoked"?"neutral":outcome.kind==="perceptual"?"warn":"bad"}`}>{outcome.kind==="exact"||outcome.kind==="authentic"?"EXACT PASSPORT MATCH · FILE INTEGRITY VERIFIED":outcome.kind==="revoked"?"REVOKED":outcome.kind==="perceptual"?"MODIFIED / RE-ENCODED COPY":"NO PASSPORT FOUND"}</span><MediaPolicySummary decision={outcome.kind==="revoked"?"revoked":outcome.kind==="perceptual"?"perceptual":outcome.kind==="none"?"none":"exact"} signedTool={outcome.data?String(val(outcome.data,"tool",3)):null} creator={outcome.data?String(val(outcome.data,"creator",2)):null}/>{(outcome.kind==="exact"||outcome.kind==="revoked")&&outcome.data&&<div style={{marginTop:16}}><h3>{outcome.kind==="revoked"?"Exact match · passport revoked":"Exact file match"}</h3><div className="meta-row"><span>Creator</span><b>{String(val(outcome.data,"creator",2))}</b></div><div className="meta-row"><span>Declared source</span><b>{parseSourceDeclaration(String(val(outcome.data,"tool",3))).source}</b></div><div className="meta-row"><span>Tool</span><b>{parseSourceDeclaration(String(val(outcome.data,"tool",3))).tool}</b></div><div className="meta-row"><span>Created</span><b>{new Date(Number(val(outcome.data,"createdAt",5))*1000).toLocaleString()}</b></div><div className="meta-row"><span>Trail entries</span><b>{outcome.trailCount??"—"}</b></div></div>}{outcome.kind==="perceptual"&&<div style={{marginTop:14}}><h3>Looks related to this passport</h3><p className="muted" style={{fontSize:11}}>Perceptual distance {outcome.distance} / 64. This is a visual similarity hint, not an exact match.</p></div>}{outcome.id&&<Link className="button button-ghost" style={{display:"inline-block",marginTop:12}} href={`/p/${outcome.id}`}>View passport & trail ↗</Link>}{outcome.hint&&<p className="muted" style={{fontSize:9,marginTop:12,marginBottom:0}}>{outcome.hint}</p>}{(outcome.kind==="exact"||outcome.kind==="revoked")&&<p className="muted" style={{fontSize:9,marginTop:7}}>An exact match confirms registered file contents. It does not independently prove who or what created the work.</p>}</div>}</section><aside className="panel"><SectionLabel>HOW THE CHECK WORKS</SectionLabel><div className="timeline" style={{marginTop:20}}><div className="timeline-item"><h4>Embedded hint</h4><p>PNG metadata is untrusted and never treated as proof.</p></div><div className="timeline-item"><h4>Exact SHA-256</h4><p>A canonical hash match retrieves the registered passport.</p></div><div className="timeline-item"><h4>Image similarity</h4><p>Images use dHash only when exact bytes differ. Videos and other files receive exact hashing only; no automatic deepfake detector is used.</p></div></div><div className="divider"/><p className="muted" style={{fontSize:10,lineHeight:1.7}}>A registry or RPC failure appears as an error. It is never reported as “no passport found.”</p><Link href="/create" className="button button-primary" style={{display:"inline-block",marginTop:4}}>Create a passport ↗</Link></aside></div></PageFrame>
}









