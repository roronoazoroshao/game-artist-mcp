import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';

if(!process.argv[2])throw Error('Usage: node scripts/r9b-krita-import-check.mjs <real-krita.ora>');
const ora=await readFile(process.argv[2]);
assert.ok(ora.length>500,'Krita ORA bytes required');
const parsed=readOpenRaster(ora,{editorProfile:'krita_5_2'});
assert.deepEqual(parsed.layers.map(layer=>layer.id),['glow','paint','hidden']);
assert.deepEqual(parsed.stackTree.children.map(group=>group.id),['materials','alternatives']);
assert.equal(parsed.stackTree.children[1].visible,false);
assert.equal(parsed.exportAllowed,false);
assert.ok(parsed.maxChannelDelta<=1);
console.log('R9B_KRITA_OPT_IN_REIMPORT_OK');
console.log(JSON.stringify({
 origin:'REAL_KRITA_5_2_EXPORTED_ARCHIVE',
 editorProfile:'krita_5_2',canvas:[parsed.width,parsed.height],
 layers:parsed.layers.map(layer=>layer.id),
 groups:parsed.stackTree.children.map(group=>group.id),
 mergedFidelity:parsed.mergedFidelity,maxChannelDelta:parsed.maxChannelDelta,
 changedPixels:parsed.changedPixels,exportAllowed:false,
 artisticReview:'UNSCORED'
}));
