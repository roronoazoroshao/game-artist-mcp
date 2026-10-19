import test from 'node:test';
import assert from 'node:assert/strict';
import {captureTrustedGameShowcase,auditTrustedAnimation,computeFrameMetrics,createArtReviewPacket} from '../src/ai-art/game-showcase.mjs';
const real=process.env.GAME_ARTIST_RUN_REAL_GODOT==='1';
test('fixed trusted scene must reject arbitrary project/script/time user parameters',async()=>{
 for(const bad of [{project:'../tienlo'},{frame:4},{frame:-1},{frame:0,script:'res://other.gd'}, {frame:1,project:'../game'}]){
  await assert.rejects(captureTrustedGameShowcase(bad),/GAME_SHOWCASE_REJECTED/);
 }
 await assert.rejects(auditTrustedAnimation({project:'../../game'}),/GAME_SHOWCASE_REJECTED/);
});
test('animation quality is objective technical telemetry, not professional artistic GO',()=>{
 const base=Uint8Array.from([20,30,40,255,30,40,50,255,0,0,0,0,10,10,10,255]);
 const next=Uint8Array.from([20,30,40,255,31,41,51,255,0,0,0,0,20,20,20,255]);
 const report=computeFrameMetrics(base,next,2,2);
 assert.ok(report.changedPixels>0);
 assert.equal(report.artisticReview,'UNSCORED');
 assert.equal(report.exportAllowed,false);
});
test('captures four actual animation frames from trusted playable Godot scene', {skip:!real},async()=>{
 const out=await captureTrustedGameShowcase({frame:2});
 assert.equal(out.source,'ACTUAL_GODOT_PLAYABLE_SHOWCASE');
 assert.equal(out.timeSeconds,0.875);
 assert.equal(out.size,512);
 assert.ok(out.png.length>10000);
 assert.match(out.sha256,/^[a-f0-9]{64}$/);
 assert.equal(out.artisticReview,'UNSCORED');
});
test('animation audit finds genuine temporal differences, never fabricates model quality scoring',{skip:!real},async()=>{
 const out=await auditTrustedAnimation({});
 assert.equal(out.frames.length,4);
 assert.ok(out.transitions.some(x=>x.changedPixels>100));
 assert.equal(out.kind,'TECHNICAL_ANIMATION_MOTION_AUDIT');
 assert.equal(out.artisticReview,'UNSCORED');
 assert.equal(out.gameScene,'TRUSTED_REPO_PLAYABLE_SHOWCASE');
});


test('review packet never autogrants aesthetic scores based on technical motion data',{skip:!real},async()=>{
 const packet=await createArtReviewPacket({});
 assert.equal(packet.kind,'ART_DIRECTION_REVIEW_PACKET_UNSCORED');
 assert.equal(packet.rubric.length,5);
 assert.ok(packet.rubric.every(x=>x.score===null));
 assert.equal(packet.technicalGate,'GODOT_CAPTURE_VERIFIED_ART_UNSCORED');
 assert.equal(packet.humanReviewerCount,0);
 assert.equal(packet.artisticReview,'UNSCORED');
 assert.equal(packet.exportAllowed,false);
});
