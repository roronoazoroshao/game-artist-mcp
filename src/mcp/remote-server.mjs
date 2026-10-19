#!/usr/bin/env node
// Authenticated stateless HTTP MCP gateway over the exact native asset workspace.
// A TLS terminator / Secure MCP Tunnel is required before any external exposure.
import {createRemoteBridge} from './http-bridge.mjs';
import {tools,callTool} from './server.mjs';
const token=process.env.GAME_ARTIST_REMOTE_BEARER_TOKEN;
const host=process.env.GAME_ARTIST_REMOTE_BIND??'127.0.0.1';
const port=Number(process.env.GAME_ARTIST_REMOTE_PORT??'8789');
if(host!=='127.0.0.1'&&host!=='::1')
 throw Error('REMOTE_MCP_REJECTED: bind only loopback; use an authenticated TLS tunnel or secure proxy');
if(!Number.isSafeInteger(port)||port<0||port>65535)
 throw Error('REMOTE_MCP_REJECTED: invalid port');
// These exact tools are the only operations permitted by a read-only principal.
// Important: artist_session_status/reinspect can reconcile a crash journal, so
// neither is truly side-effect-free and they are deliberately NOT in this set.
const readOnlyToolNames=[
 'asset_get','paint_preview','paint_compare','paint_diff_preview',
 'paint_evaluate','paint_scene_observe','paint_scene_compare',
 'art_game_capture','art_animation_audit','art_quality_review_packet'
];
const readOnlySet=new Set(readOnlyToolNames);
const heavyToolNames=[
 'paint_scene_observe','paint_scene_compare','art_game_capture',
 'art_animation_audit','art_quality_review_packet','artist_session_observe'
];
const permitted=tools.filter(t=>/^paint_|^artist_session_|^art_(game_capture|animation_audit|quality_review_packet)$|^asset_create$|^asset_get$/.test(t.name))
 .map(t=>({...t,annotations:{
   title:t.name,readOnlyHint:readOnlySet.has(t.name),
   destructiveHint:false,openWorldHint:false,
   idempotentHint:readOnlySet.has(t.name)
 }}));
const server=createRemoteBridge({
 token,readOnlyToken:process.env.GAME_ARTIST_REMOTE_READONLY_TOKEN??null,
 readOnlyToolNames,tools:permitted,callTool,heavyToolNames,
 maxConcurrent:2,maxCallsPerMinute:120,maxHeavyPerMinute:8,
 allowedOrigins:['https://chatgpt.com','https://chat.openai.com'],
 onAudit:record=>process.stderr.write('GAME_ARTIST_REMOTE_AUDIT '+JSON.stringify(record)+'\n')
});
server.listen(port,host,()=>{
 const address=server.address();
 process.stderr.write('GAME_ARTIST_REMOTE_READY '+JSON.stringify({bind:host,port:address.port,
  route:'/mcp',tools:permitted.length,hasTLS:false,remoteNotYetConnected:true})+'\n');
});
