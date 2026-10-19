import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {parseUniqueKeysJsonLine} from './strict-json.mjs';

const MAX_REQUEST=262144;
const VERSION='2025-11-25';
const SUPPORTED=new Set([VERSION,'2025-06-18','2025-03-26']);
const failure=m=>{throw Error('REMOTE_MCP_REJECTED: '+m)};
const reply=(res,status,body)=>{
 const bytes=Buffer.from(JSON.stringify(body));
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','content-length':String(bytes.length)});
 res.end(bytes);
};
const rpcError=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
const errText=msg=>({isError:true,content:[{type:'text',text:msg}]});
const digest=t=>createHash('sha256').update(t).digest();
const authorized=(given,expected)=>{
 if(typeof given!=='string'||!given.startsWith('Bearer '))return false;
 const candidate=given.slice(7);
 if(candidate.length<32||candidate.length>4096)return false;
 return timingSafeEqual(digest(candidate),digest(expected));
};
export function createRemoteBridge({token,tools,callTool,allowedOrigins=[],maxConcurrent=2}={}){
 if(typeof token!=='string'||token.length<32||token.length>4096||!/^[A-Za-z0-9_.~+/-]+$/.test(token))
  failure('required strong bearer token; not a development-only default');
 if(!Array.isArray(tools)||tools.some(t=>!t.name||!t.inputSchema)||typeof callTool!=='function')
  failure('requires a discovered real tool surface and callable engine');
 if(!Array.isArray(allowedOrigins)||allowedOrigins.some(x=>typeof x!=='string'||!x.startsWith('https://')))
  failure('only HTTPS origins in explicit allowlist');
 const registry=new Map();
 for(const t of tools){if(registry.has(t.name))failure('duplicate tools');registry.set(t.name,t);}
 let active=0;
 return createServer(async(req,res)=>{
  const auth=req.headers.authorization;
  if(!authorized(auth,token)){
   reply(res,401,{error:'Authorization required'});return;
  }
  const origin=req.headers.origin;
  if(origin && !allowedOrigins.includes(origin)){
   reply(res,403,{error:'Disallowed origin'});return;
  }
  if(req.url!=='/mcp'){
   reply(res,404,{error:'Not found'});return;
  }
  if(req.method!=='POST'){
   res.setHeader('allow','POST');
   reply(res,405,{error:'Use MCP JSON-RPC POST'});return;
  }
  const accept=req.headers.accept||'';
  if(!accept.includes('application/json')||!accept.includes('text/event-stream')){
   reply(res,406,{error:'Accept must include application/json and text/event-stream'});return;
  }
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')){
   reply(res,415,{error:'JSON only'});return;
  }
  if(Number(req.headers['content-length']||0)>MAX_REQUEST){
   reply(res,413,{error:'MCP JSON request exceeds input budget'});return;
  }
  const buffers=[];let size=0;
  try{
   for await(const b of req){
    size+=b.length;
    if(size>MAX_REQUEST){reply(res,413,{error:'MCP JSON request exceeds input budget'});return;}
    buffers.push(b);
   }
  }catch{if(!res.writableEnded)reply(res,400,{error:'Invalid request body'});return}
  let msg;
  try{msg=parseUniqueKeysJsonLine(Buffer.concat(buffers).toString('utf8'))}
  catch{reply(res,400,rpcError(null,-32700,'Invalid or ambiguous JSON'));return}
  if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string'){
   reply(res,400,rpcError(null,-32600,'Invalid JSON-RPC envelope'));return;
  }
  if(msg.id===undefined){
   if(msg.method==='notifications/initialized'){
    res.writeHead(202,{'cache-control':'no-store'});res.end();return;
   }
   reply(res,400,rpcError(null,-32600,'Unsupported notification'));return;
  }
  const id=msg.id;
  if(!(typeof id==='string'||(typeof id==='number'&&Number.isSafeInteger(id)))){
   reply(res,400,rpcError(null,-32600,'Invalid request ID'));return;
  }
  let output;
  if(msg.method==='initialize'){
   if(!SUPPORTED.has(msg.params?.protocolVersion)){
    reply(res,200,rpcError(id,-32602,'Unsupported MCP protocol version'));return;
   }
   output={protocolVersion:msg.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'game-artist-remote-mcp',version:'0.1.0'}};
  }else if(msg.method==='ping')output={};
  else if(msg.method==='tools/list')output={tools:[...registry.values()]};
  else if(msg.method==='tools/call'){
   const name=msg.params?.name;
   if(typeof name!=='string'||!registry.has(name)){
    reply(res,200,rpcError(id,-32602,'Unknown or disallowed MCP tool'));return;
   }
   const args=msg.params?.arguments??{};
   if(args===null||typeof args!=='object'||Array.isArray(args)){
    reply(res,200,rpcError(id,-32602,'Tool arguments must be an object'));return;
   }
   if(active>=maxConcurrent){
    reply(res,429,rpcError(id,-32000,'Gateway busy; retry with same asset revision'));return;
   }
   active++;
   try{
    output=await callTool(name,args);
   }catch(e){output=errText(String(e?.message||'MCP tool execution rejected').slice(0,300));}
   finally{active--;}
  }else{
   reply(res,200,rpcError(id,-32601,'Method not found'));return;
  }
  reply(res,200,{jsonrpc:'2.0',id,result:output});
 });
}
