/**
 * Actual app filming through unmodified demo-studio camera/cursor libraries.
 * Production timing uses aligned.json. --silent-preview explicitly permits
 * provisional 62-second timing while KIE is unavailable.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { loadConfig } from './engine/config.mjs';
import { createTimeline } from './engine/timeline.mjs';
import { createFilmContext, prepareFilmPage, startFilmRecording, finishFilmRecording } from './engine/record.mjs';
import { click, type, focus, wide, scroll, settle, filmMove, appear, done } from './engine/actions.mjs';
import { composeFilm } from './engine/compose.mjs';
import { verifyFilm } from './engine/verify.mjs';
import { inspectFilm } from './engine/inspect.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '../..');
const config = loadConfig(root);
const preview = process.argv.includes('--silent-preview');
const alignmentPath = join(dir, 'aligned.json');
if (!preview && (!existsSync(alignmentPath) || !existsSync(join(dir,'narration.mp3'))))
  throw Error('Generate KIE narration and Whisper alignment first, or explicitly use --silent-preview.');
const aligned = !preview ? JSON.parse(readFileSync(alignmentPath,'utf8')) : null;
const paragraphs = readFileSync(join(dir,'narration.txt'),'utf8').trim().split(/\r?\n/);
const sentenceCounts = paragraphs.map(p=>p.split(/(?<=[.!?])\s+/).length);
let offset = 0;
const fallback = [6,6,6,9,11,8,10,6];
const durations = sentenceCounts.map((count,i)=>{
  const block = aligned?.sentences.slice(offset,offset+count);
  offset += count;
  return block?.length ? Math.max(3,block.at(-1).end-block[0].start+1.2) : fallback[i];
});
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const renderDir = join(dir,'renders',stamp);
mkdirSync(renderDir,{recursive:true});
const scenes = [];
const browser = await chromium.launch({headless:true,args:[
  '--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
let context, page, recorder;
try {
  // Off-camera route warm-up. No RPC interception, fake data or substituted UI.
  const warm = await browser.newPage();
  for (const path of ['/create','/demo','/p/'+'0x'+'0'.repeat(64)]) {
    await warm.goto(config.app.baseUrl+path,{waitUntil:'domcontentloaded'});
    await warm.locator('h1').waitFor();
  }
  await warm.close();
  context = await createFilmContext(browser,renderDir,{viewport:config.app.viewport});
  page = await context.newPage();
  await prepareFilmPage(page,config.cursor);
  await page.goto(config.app.baseUrl,{waitUntil:'domcontentloaded'});
  await settle(page);
  const timeline = createTimeline();
  recorder = await startFilmRecording(page,renderDir,timeline);
  const scene = (index,label)=>{
    const entry = {index,label,start:timeline.now(),duration:durations[index],sentenceIndices:[]};
    let first = sentenceCounts.slice(0,index).reduce((a,b)=>a+b,0);
    entry.sentenceIndices = Array.from({length:sentenceCounts[index]},(_,j)=>first+j);
    timeline.mark('scene',label);
    scenes.push(entry);
    console.log(`Scene ${index+1}: ${label}`);
    return entry;
  };
  const hold = async entry=>{
    const remaining = Math.max(1.2,entry.start+entry.duration-timeline.now());
    await page.waitForTimeout(remaining*1000);
    entry.end=timeline.now();
  };
  const zoom = async(locator,label)=>focus(page,timeline,locator,label,config.camera);
  const scrollTo = async(locator,y,label)=>{
    const box=await locator.boundingBox();
    if(!box)throw Error(`Missing region: ${label}`);
    await scroll(page,timeline,box.y-y,label,{steps:18,stepMs:35});
  };
  const nav = name=>page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name,exact:true});

  let beat=scene(0,'problem-and-passport');
  await wide(page,timeline,'opening-hero');
  await filmMove(page,timeline,890,590);
  await hold(beat);

  beat=scene(1,'real-local-application');
  await click(page,timeline,nav('Create'),'create-route',{expect:page.locator('#tool')});
  await click(page,timeline,page.getByRole('button',{name:'Planet No. 04'}),'prepare-bundled-artwork',{
    expect:page.locator('section.panel .dropzone img')});
  await hold(beat);

  beat=scene(2,'declare-and-fingerprint');
  const sourceBox=await page.locator('#source-type').boundingBox();
  const toolBox=await page.locator('#tool').boundingBox();
  await zoom({x:sourceBox.x-14,y:sourceBox.y-32,width:sourceBox.width+28,height:toolBox.y+toolBox.height-sourceBox.y+92},'source-and-fingerprint');
  await click(page,timeline,page.locator('#tool'),'creation-tool');
  await page.locator('#tool').press('ControlOrMeta+A');
  await type(page,timeline,page.locator('#tool'),'Procedural demo artwork','creation-tool-text',{delay:30});
  await hold(beat);

  beat=scene(3,'signed-synthetic-registration');
  await wide(page,timeline,'registration-wide');
  await click(page,timeline,nav('Demo'),'guided-demo-route',{expect:page.getByRole('button',{name:'Register a real asset'})});
  const downloadPromise=page.waitForEvent('download');
  await click(page,timeline,page.getByRole('button',{name:'Register a real asset'}),'register-real-local-transaction',{
    expect:page.getByText('Registration confirmed.',{exact:false})});
  const download=await downloadPromise;
  const saved=join(renderDir,'registered-passport.png');
  await download.saveAs(saved);
  const link=page.locator('section.panel a[href^="/p/"]');
  const passportId=(await link.getAttribute('href')).split('/').at(-1);
  // The app already supports local sessionStorage previews (Create uses it).
  // Supply actual downloaded bytes, never an invented image or registry field.
  const imageData='data:image/png;base64,'+readFileSync(saved).toString('base64');
  await page.evaluate(({id,data})=>sessionStorage.setItem(`px:asset:${id}`,data),{id:passportId,data:imageData});
  await zoom({x:374,y:336,width:785,height:166},'signed-source-result');
  await hold(beat);

  beat=scene(4,'download-and-exact-file-check');
  await wide(page,timeline,'verification-wide');
  const chooserPromise=page.waitForEvent('filechooser');
  await click(page,timeline,page.getByRole('button',{name:'Verify the downloaded copy'}),'choose-downloaded-png');
  const chooser=await chooserPromise;
  await chooser.setFiles(saved);
  await page.getByText('matches live registry record',{exact:false}).waitFor();
  await zoom({x:374,y:336,width:785,height:166},'exact-match-and-declaration');
  await hold(beat);

  beat=scene(5,'one-pixel-change-and-similarity');
  await wide(page,timeline,'edit-wide');
  await click(page,timeline,page.getByRole('button',{name:'Change one pixel'}),'change-one-real-pixel',{
    expect:page.getByText('One pixel changed; exact hash differs.',{exact:false})});
  await zoom({x:374,y:336,width:785,height:188},'changed-file-warning');
  await hold(beat);

  beat=scene(6,'append-and-verify-history');
  await wide(page,timeline,'history-wide');
  await click(page,timeline,page.getByRole('button',{name:'Append the derivative'}),'append-real-local-event',{
    expect:page.getByText('A real derivative event was confirmed',{exact:false})});
  await scroll(page,timeline,510,'reveal-public-passport-link',{steps:14,stepMs:35});
  await click(page,timeline,link,'open-public-passport',{expect:page.locator('.trail-proof'),expectTimeout:15000});
  await page.getByText('Complete trail verified against on-chain head',{exact:false}).waitFor();
  const proof=page.locator('.trail-proof');
  await scrollTo(proof,300,'reveal-hash-chain-history');
  const history=await page.locator('section.panel .timeline').boundingBox();
  const proofBox=await proof.boundingBox();
  await zoom({x:proofBox.x-18,y:proofBox.y-40,width:proofBox.width+36,height:history.y+history.height-proofBox.y+64},'complete-hash-chain-history');
  await hold(beat);

  beat=scene(7,'review-before-sharing');
  await wide(page,timeline,'closing-wide');
  await scrollTo(page.getByLabel('File integrity and source declaration'),300,'return-to-passport-and-badge');
  await filmMove(page,timeline,1165,440);
  await hold(beat);
  await wide(page,timeline,'final-wide');
  await page.waitForTimeout(1200);
  timeline.dump(join(renderDir,'timeline.json'));
  writeFileSync(join(renderDir,'scenes.json'),JSON.stringify({provisional:preview,scenes,passportId,localEvm:true},null,2));
  const capture=await finishFilmRecording(context,page,renderDir,recorder);
  recorder=null;
  if(!capture.ok)throw Error('Capture did not produce raw.mp4.');
  await browser.close();
  const result=await composeFilm(renderDir,{preset:config.frame.preset,...config.camera,
    canvasW:1920,canvasH:1080,padX:40,padY:56,
    speedupConfig:{...config.speedup,tailHold:4},out:join(dir,'no-sound.mp4')});
  // Narration reading holds are intentional. Retain strict capture/blank checks.
  const review=verifyFilm(renderDir,{min:45,max:110,deadAir:14});
  inspectFilm(renderDir,[2,12,22,32,42,52,60]);
  writeFileSync(join(dir,'latest-render.json'),JSON.stringify({renderDir,provisional:preview,capture,review},null,2));
  console.log(`Silent master: ${join(dir,'no-sound.mp4')}`);
  console.log(`Capture ${capture.capturedFps}fps; verification pass: ${review.pass}`);
  if(!review.pass)throw Error('Film verification failed; inspect review/report before delivering.');
} catch(error) {
  if(page&&!page.isClosed()){
    await page.screenshot({path:join(renderDir,'failure.png')}).catch(()=>{});
    writeFileSync(join(renderDir,'failure.txt'),`${error.message}\nURL: ${page.url()}\n`);
  }
  throw error;
} finally {
  if(recorder&&context&&page)await finishFilmRecording(context,page,renderDir,recorder).catch(()=>{});
  await browser.close().catch(()=>{});
}
