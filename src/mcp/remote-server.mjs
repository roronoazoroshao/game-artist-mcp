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
const permitted=tools.filter(t=>/^paint_|^artist_session_|^art_(game_capture|animation_audit|quality_review_packet)$|^asset_create$|^asset_get$/.test(t.name))
 .map(t=>({...t,annotations:{
   title:t.name,readOnlyHint:/^art_(game_capture|animation_audit|quality_review_packet)$|^paint_(preview|compare|diff_preview|evaluate|scene_observe|scene_compare)$|^artist_session_(status|reinspect)$|^asset_get$/.test(t.name),
   destructiveHint:false,openWorldHint:false,
   idempotentHint:/^(paint_preview|paint_compare|paint_diff_preview|paint_scene_observe|paint_scene_compare|artist_session_status|artist_session_reinspect|asset_get)$/.test(t.name)
 }}));
const server=createRemoteBridge({token,tools:permitted,callTool,
 allowedOrigins:['https://chatgpt.com','https://chat.openai.com']});
server.listen(port,host,()=>{
 const address=server.address();
 process.stderr.write('GAME_ARTIST_REMOTE_READY '+JSON.stringify({bind:host,port:address.port,
  route:'/mcp',tools:permitted.length,hasTLS:false,remoteNotYetConnected:true})+'\n');
});
