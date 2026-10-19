# Game Artist Workstation V6 — Direct ChatGPT MCP connection

## What is working

The repository contains a **stateless Streamable HTTP MCP gateway** (POST /mcp), separate from the stdio engine, with an explicit Bearer credential. It advertises only 21 asset/painting/vision/game-art tools and does NOT expose shell_exec, arbitrary Godot scripts, unrestricted filesystem or git operations. The ChatGPT vision model may select tools and inspect returned actual PNG image content; no second image model is invoked.

Commands on the trusted VPS (after reviewing permissions and environment):

- `GAME_ARTIST_REMOTE_BEARER_TOKEN=<strong-secret> GAME_ARTIST_REMOTE_BIND=127.0.0.1 GAME_ARTIST_REMOTE_PORT=8789 npm run mcp:remote -- --workspace /path/to/private/workspace`
- `npm run smoke:mcp:remote` for stateless HTTP protocol, authentication and image tool response.
- `GAME_ARTIST_RUN_REAL_GODOT=1 npm run smoke:mcp:remote` for a real Godot capture through HTTP.
- `GAME_ARTIST_RUN_REAL_GODOT=1 node --test test/artist-game-showcase-v6.test.mjs` for real game scene/animation captures.

This service **must not be bound publicly as plain HTTP**. It refuses non-loopback binds. Connect it to ChatGPT using a **Secure MCP Tunnel**, or a trusted TLS reverse proxy/Cloudflare Tunnel with authorization. Do not commit the Bearer token or paste it into chats. The TLS proxy itself is a separate deployment with permissions, service management and monitoring.

## ChatGPT plugin connection

After a legitimate HTTPS address or Secure MCP Tunnel is ready, go to ChatGPT Plugins → plus → Add custom MCP server, provide the remote /mcp endpoint or tunnel ID, configure authentication, acknowledge write-action risk, create the plugin and install/select it in the chat. The ChatGPT app must actually scan and authorize the remote tools. Tool availability depends on the account/workspace and policy. In current OpenAI guidance, full MCP write actions are subject to Business/Enterprise/Edu access restrictions; a private plugin cannot bypass those restrictions. If registration isn't available, report **CHATGPT_CONNECTION_BLOCKED**, not working. Check https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt.

OMX Web v0.4.0 is a **skills-first plugin with only GitHub declared**. Updating skill text does not register Game Artist tool actions. The separate direct MCP connection, once installed, is the native tool surface; OMX Web can orchestrate it only when genuinely available in the host.

## Exposed scopes / security policy

- 21 tools: artist_session_*, paint_*, art_game_capture, art_animation_audit, art_quality_review_packet, asset_create and asset_get.
- All other 10 legacy MCP tools are intentionally hidden from the remote gateway until security-reviewed.
- `asset_id` and painting revisions remain validated by the underlying existing asset workspace. Images are sha-pinned and limited; up to three ChatGPT-authored revisions in a bounded art session.
- HTTP JSON-RPC max 256KiB input, token length at least 32, exact-name tool registry, strict JSON duplicate key guard, explicit Origin allowlist, concurrent operations cap, no unsolicited CORS or GET streaming.
- No local/open-loop fake artistic approval; `artisticReview: UNSCORED`, `rightsVerified:false`, `exportAllowed:false` remain.
- Security limitation: static bearer is a single trusted operator identity; production multi-user OAuth, user-specific workspace isolation, rate limiting across workers and secure reverse-proxy logs are **not yet delivered**. Never claim enterprise multi-tenant authorization.
- Use only a trusted repository's built-in playable Godot scene for animation capture; no arbitrary user-supplied game scripts are executed via this endpoint.

## Gameplay scene and animation

The built-in actual playable spirit-lantern game scene from `examples/spirit-lantern/generated/phase3-godot` is copied into a bounded temporary directory, imported by Godot, then run with actual OpenGL framebuffer/Xvfb. Four frame samples at 0, .375, .875, and 1.375 seconds are captured, hashed and inspected.

- `art_game_capture(frame: 0..3)` returns actual 512px PNG from the playable scene.
- `art_animation_audit({})` compares temporal frames with actual changed pixels and luminance deltas. It does **not** prove high FPS, smoothness or beauty.
- `art_quality_review_packet({})` produces a human/ChatGPT visual review rubric with **null scores** until someone actually reviews the images.
- The external target game (for example a separate Godot repository) still needs explicit mapping and isolated worker/container sandbox. This endpoint never opens arbitrary `project_path` supplied in tool arguments.

## Release gate

This branch is a Draft PR on top of V5 #50; no merge or production art release. Full GitHub exact-HEAD CI on the new change is required. Real ChatGPT app tool registration and native write-action calls have not yet been observed. Do not claim the server is connected simply because an HTTP smoke test succeeded.
