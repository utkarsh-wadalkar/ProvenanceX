import { NextRequest, NextResponse } from "next/server";
import { getPassportIdByContentHash, getPassport } from "@/lib/registry";
import { requireDeployment } from "@/lib/deployment";
import { evaluateMediaPolicy } from "@/lib/sourceDeclaration";
const HASH=/^0x[0-9a-fA-F]{64}$/;
export async function GET(request: NextRequest) {
 const hash=request.nextUrl.searchParams.get("hash");
 if(!hash||!HASH.test(hash))return NextResponse.json({error:"Provide a 32-byte hash as ?hash=0x…"},{status:400});
 try {
  const address=requireDeployment();
  const work=(async()=>{const id=await getPassportIdByContentHash(hash as `0x${string}`);if(/^0x0{64}$/i.test(id)){const policy=evaluateMediaPolicy({decision:"none",trustedPublishers:process.env.NEXT_PUBLIC_TRUSTED_PUBLISHERS});return {exists:false,passportId:null,creator:null,tool:null,createdAt:null,revoked:false,trailHead:null,trailLength:"0",declaration:policy.declaration,publisherTrust:policy.publisherTrust,reviewRequired:policy.reviewRequired}}const data=await getPassport(id) as Record<string,unknown>;const pick=(key:string,index:number)=>data[key]??Object.values(data)[index];const creator=pick("creator",2);const tool=pick("tool",3);const revoked=Boolean(pick("revoked",8));const policy=evaluateMediaPolicy({decision:revoked?"revoked":"exact",signedTool:String(tool??""),creator:String(creator??""),trustedPublishers:process.env.NEXT_PUBLIC_TRUSTED_PUBLISHERS});return {exists:true,passportId:id,creator,tool,createdAt:String(pick("createdAt",5)),revoked,trailHead:pick("trailHead",7),trailLength:String(await (await import("@/lib/registry")).getTrailLength(id)),declaration:policy.declaration,publisherTrust:policy.publisherTrust,reviewRequired:policy.reviewRequired}})();
  const result=await Promise.race([work,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("RPC request timed out.")),15000))]);return NextResponse.json(result,{headers:{"cache-control":"no-store"}});
 } catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Verification service is unavailable."},{status:503,headers:{"cache-control":"no-store"}})}
}
