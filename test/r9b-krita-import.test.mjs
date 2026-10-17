import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEditorInteropFixture} from '../scripts/r9b-editor-fixture.mjs';
import {readOraZip,writeOraZip} from '../src/ai-art/ora-zip.mjs';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';

// Synthetic form mimics actual XML attributes observed in Krita 5.2.2 export.
// The GitHub Actions editor workflow tests real Krita-generated ORA bytes.
function editorBytes(mutator=(s)=>s){
 const files=readOraZip(buildEditorInteropFixture().ora);
 let xml=files.get('stack.xml').toString('utf8');
 xml=xml.replace(/<image [^>]+>/,
  '<image w="64" version="0.0.1" h="64" xres="75" yres="75">');
 xml=xml.replace('<stack>','<stack opacity="1" name="" x="0" isolation="isolate" composite-op="svg:src-over" y="0" visibility="visible">');
 xml=xml.replace(/<stack name="([^"]+)"/g,'<stack name="$1" x="0" y="0"');
 xml=xml.replace('opacity="0.75" visibility="visible"','opacity="0.74902" visibility="visible"');
 xml=mutator(xml);
 return writeOraZip([...files].map(([name,bytes])=>({name,bytes:name==='stack.xml'?Buffer.from(xml):bytes})));
}
const reject=fn=>assert.throws(fn,/R9B_ORA_REJECTED|R9B_STACK_REJECTED|R9B_INVALID_LAYER|AI_PNG_REJECTED/);
test('R9b opt-in Krita 5.2 importer accepts known safe nested editor metadata with bounded pixel delta',()=>{
 const ora=editorBytes();
 reject(()=>readOpenRaster(ora),'strict legacy parser stays strict');
 const doc=readOpenRaster(ora,{editorProfile:'krita_5_2'});
 assert.deepEqual([doc.width,doc.height],[64,64]);
 assert.deepEqual(doc.layers.map(l=>l.id),['glow','paint','hidden']);
 assert.deepEqual(doc.stackTree.children.map(g=>g.id),['materials','alternatives']);
 assert.equal(doc.stackTree.children[1].visible,false);
 assert.ok(['PIXEL_EXACT','BOUNDED_1LSB_NOT_PIXEL_EXACT'].includes(doc.mergedFidelity));
 assert.equal(doc.exportAllowed,false);
});
test('R9b Krita opt-in rejects suspicious group geometry, unknown XML version and DTD',()=>{
 reject(()=>readOpenRaster(editorBytes(s=>s.replace('name="materials" x="0"','name="materials" x="3"')),{editorProfile:'krita_5_2'}));
 reject(()=>readOpenRaster(editorBytes(s=>s.replace('version="0.0.1"','version="9.9.9"')),{editorProfile:'krita_5_2'}));
 reject(()=>readOpenRaster(editorBytes(s=>s.replace('<image ', '<!DOCTYPE image SYSTEM "file:///etc/passwd"><image ')),{editorProfile:'krita_5_2'}));
 reject(()=>readOpenRaster(editorBytes(s=>s.replace('svg:src-over','svg:screen')),{editorProfile:'krita_5_2'}));
 reject(()=>readOpenRaster(editorBytes(),{editorProfile:'untrusted_other_editor'}));
});
