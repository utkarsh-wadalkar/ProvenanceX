import Link from "next/link";
import Image from "next/image";
import { PageFrame, SectionLabel } from "@/components/shell";
import { getTotalPassports } from "@/lib/registry";
import { deploymentInfo } from "@/lib/deployment";

export const dynamic = "force-dynamic";

function validRepositoryUrl(value?: string) {
  if (!value || value.length > 256) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && /^\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

export default async function Home() {
  const sourceUrl = validRepositoryUrl(process.env.NEXT_PUBLIC_GITHUB_URL);
  let count: string | null = null;
  if (deploymentInfo.address) { try { count = (await getTotalPassports()).toString(); } catch { count = null; } }

  return <PageFrame>
    <section className="hero">
      <div className="hero-copy">
        <SectionLabel>VERIFIED PUBLISHER & SOURCE INTEGRITY</SectionLabel>
        <h1>Verify the source,<br/><em>not just the content.</em></h1>
        <p>
          ProvenanceX establishes cryptographic trust for official media. Verify whether an official photograph, disaster notice, or press release was registered by a genuinely trusted authority—such as a government official, police department, or newsroom—on Monad.
        </p>
        <div className="hero-actions">
          <Link href="/create" className="button button-primary">Register Official Media ↗</Link>
          <Link href="/verify" className="button button-ghost">Verify Publisher Media</Link>
        </div>
        <div className="micro-proof">
          <span><b>01</b> · IDENTITY VERIFICATION</span>
          <span><b>02</b> · SIGNED PUBLICATION</span>
          <span><b>03</b> · CITIZEN AUDIT</span>
        </div>
      </div>
      <div className="visual-stage" aria-label="Official media registration illustration">
        <div className="orbital"><i className="orbit-dot"/></div>
        <div className="float-note note-top">VERIFIED <b>· GOVERNMENT ISSUER</b></div>
        <div className="pass-card">
          <div className="card-top">
            <span>PROVENANCEX / OFFICIAL RELEASE</span>
            <span>VERIFIED SOURCE</span>
          </div>
          <div className="card-stamp">
            <Image unoptimized width={1200} height={900} src="/samples/planet.png" alt="Sample official publication"/>
          </div>
          <div className="card-title">Official Department Release</div>
          <div className="card-meta">
            <span>GOVERNMENT DEPT WALLET</span>
            <span>MONAD · 10143</span>
          </div>
          <div className="seal">VERIFIED<br/>SOURCE</div>
        </div>
        <div className="float-note note-bottom">MONAD <b>· IMMUTABLE TRAIL</b></div>
      </div>
    </section>

    <section className="section">
      <div className="section-head">
        <div>
          <SectionLabel>TRUST ARCHITECTURE</SectionLabel>
          <h2>Verify whether media was registered by a genuinely trusted authority.</h2>
        </div>
        <span className="muted" style={{fontSize:11}}>Moving beyond unreliable visual content guessing.</span>
      </div>

      <div className="steps">
        <article className="step">
          <span className="step-num">01 / IDENTITY VERIFICATION</span>
          <h3><span className="step-symbol">◈</span> &nbsp;Verified Wallet</h3>
          <p>A government department or newsroom registers its official wallet with ProvenanceX after independent identity verification.</p>
        </article>
        <article className="step">
          <span className="step-num">02 / SIGNED PUBLICATION</span>
          <h3><span className="step-symbol">✳</span> &nbsp;Monad Registration</h3>
          <p>An authorized official uploads media and signs it. Monad records the exact file hash, wallet identity, timestamp, and provenance metadata.</p>
        </article>
        <article className="step">
          <span className="step-num">03 / CITIZEN VERIFICATION</span>
          <h3><span className="step-symbol">⌁</span> &nbsp;Independent Audit</h3>
          <p>Citizens upload downloaded media to check whether it matches the department&apos;s registered publication and verified wallet signature.</p>
        </article>
      </div>

      <div className="panel" style={{marginTop:30}}>
        <SectionLabel>REGISTRATION TYPE & EVIDENCE LEVELS</SectionLabel>
        <h3 style={{margin:"10px 0 16px"}}>Distinguishing ordinary claims from institutional authority</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,textAlign:"left"}}>
            <thead>
              <tr style={{borderBottom:"1px solid var(--line)",color:"var(--muted)",font:"10px ui-monospace,monospace"}}>
                <th style={{padding:"10px 14px"}}>REGISTRATION TYPE</th>
                <th style={{padding:"10px 14px"}}>TRUST LEVEL</th>
                <th style={{padding:"10px 14px"}}>EVIDENCE & SOURCE QUALITY</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{borderBottom:"1px solid #ffffff0c"}}>
                <td style={{padding:"12px 14px"}}>Anonymous wallet claims &quot;Real&quot;</td>
                <td style={{padding:"12px 14px"}}><span className="muted">Self-declared</span></td>
                <td style={{padding:"12px 14px",color:"#888"}}>Unverified signer; origin review required</td>
              </tr>
              <tr style={{borderBottom:"1px solid #ffffff0c"}}>
                <td style={{padding:"12px 14px"}}>Identity-verified photographer signs photo</td>
                <td style={{padding:"12px 14px"}}><span className="purple">Verified publisher identity</span></td>
                <td style={{padding:"12px 14px",color:"#bbb"}}>Individual creator identity verified</td>
              </tr>
              <tr style={{borderBottom:"1px solid #ffffff0c"}}>
                <td style={{padding:"12px 14px"}}>Government department signs official release</td>
                <td style={{padding:"12px 14px"}}><span style={{color:"var(--green)"}}>Verified official source</span></td>
                <td style={{padding:"12px 14px",color:"#eee"}}>Cryptographically backed institutional publication</td>
              </tr>
              <tr>
                <td style={{padding:"12px 14px"}}>Camera provides cryptographically signed capture</td>
                <td style={{padding:"12px 14px"}}><span className="coral">Stronger capture provenance</span></td>
                <td style={{padding:"12px 14px",color:"#eee"}}>Hardware sensor cryptographic attestation + C2PA link</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-head" style={{marginTop:50}}>
        <div>
          <SectionLabel>USE CASES</SectionLabel>
          <h2>Built for institutions, journalism & public trust.</h2>
        </div>
      </div>

      <div className="steps" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        <article className="step">
          <span className="step-num">GOVERNMENT ANNOUNCEMENTS</span>
          <h3>Official Public Releases</h3>
          <p>Citizens verify whether a circulated disaster notice, official photograph, or press release matches an authorized government publication.</p>
        </article>
        <article className="step">
          <span className="step-num">VERIFIED JOURNALISM</span>
          <h3>Newsroom Integrity</h3>
          <p>News organizations register original reporting and editorial photography to distinguish authentic published media from online impersonations.</p>
        </article>
        <article className="step">
          <span className="step-num">CREATORS & PHOTOGRAPHERS</span>
          <h3>Inspectable Attribution</h3>
          <p>Photographers establish a publicly inspectable publication history on Monad and connect their original work directly to licensing services.</p>
        </article>
      </div>

      <div className="why-strip">
        <div>
          <SectionLabel>WHY MONAD</SectionLabel>
          <p>Sub-second finality and low transaction costs make per-asset provenance practical for government departments, newsrooms, and public institutions.</p>
        </div>
        <div>
          <strong>{count ?? "—"}</strong>
          <small className="muted" style={{display:"block",fontSize:9,marginTop:7,letterSpacing:".13em"}}>OFFICIAL MEDIA RECORDS {count ? "· LIVE" : "· UNAVAILABLE"}</small>
        </div>
        <div>
          {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="muted" style={{fontSize:11}}>Source repository ↗</a> : <span className="muted" style={{fontSize:11}}>Source repository pending</span>}
          <p><a href={deploymentInfo.address ? `https://testnet.monadexplorer.com/address/${deploymentInfo.address}` : "https://testnet.monadexplorer.com"} target="_blank" rel="noreferrer" className="muted" style={{fontSize:11}}>{deploymentInfo.address ? "Contract explorer ↗" : "Monad Testnet explorer ↗"}</a></p>
        </div>
      </div>

      <div className="panel" style={{marginTop:20,display:"flex",justifyContent:"space-between",alignItems:"center",gap:20}}>
        <div>
          <SectionLabel>VERIFIED PUBLISHER REGISTRY</SectionLabel>
          <p className="muted" style={{fontSize:11,lineHeight:1.7,margin:"9px 0 0"}}>
            ProvenanceX provides verified publisher onboarding, bulk registration APIs, automated monitoring, and evidence-based verification for enterprise and government partners.
          </p>
        </div>
        <span className="purple" style={{font: "10px ui-monospace,monospace",whiteSpace:"nowrap"}}>C2PA ALIGNED · MONAD TESTNET</span>
      </div>

      <div className="bottom-cta">
        <div>
          <SectionLabel>AUTHENTIC PUBLICATION</SectionLabel>
          <h2>Make your official releases independently verifiable.</h2>
        </div>
        <Link href="/create" className="button button-primary">Register Official Media ↗</Link>
      </div>
    </section>
  </PageFrame>;
}
