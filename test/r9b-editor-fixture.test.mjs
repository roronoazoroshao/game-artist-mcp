import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readOpenRaster} from '../src/ai-art/openraster.mjs';
import {buildEditorInteropFixture} from '../scripts/r9b-editor-fixture.mjs';

test('R9b editor fixture contains three editable layers, nested group, hidden paint and alpha',()=>{
 const {ora,evidence}=buildEditorInteropFixture();
 const doc=readOpenRaster(ora);
 assert.deepEqual([doc.width,doc.height],[64,64]);
 assert.deepEqual(doc.layers.map(l=>l.id),['glow','paint','hidden']);
 assert.equal(doc.stackTree.children[0].id,'materials');
 assert.equal(doc.stackTree.children[1].id,'alternatives');
 assert.equal(doc.stackTree.children[1].visible,false);
 assert.equal(doc.layers[0].opacity,0.75);
 assert.equal(doc.layers[1].x,6);
 assert.equal(doc.layers[1].y,9);
 assert.equal(evidence.origin,'SYNTHETIC_INTEROP_FIXTURE_NOT_ART');
 assert.equal(evidence.artisticReview,'UNSCORED');
 assert.equal(evidence.commercialRightsCleared,false);
 assert.equal(evidence.oraSha256,createHash('sha256').update(ora).digest('hex'));
 assert.deepEqual(ora,buildEditorInteropFixture().ora);
});
