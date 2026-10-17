import {readFile} from 'node:fs/promises';
import {auditR9dPartRegistry} from '../src/ai-art/r9d-part-registry.mjs';

const registry=JSON.parse(await readFile(
 new URL('../examples/spirit-lantern/r9d/parts/paint-operations-001.json',import.meta.url),'utf8'
));
const result=auditR9dPartRegistry(registry);
if(result.status!=='SOURCE_BYTES_NOT_ARCHIVED'||result.exportAllowed!==false)
 throw Error('R9D_IMPORT_READINESS_FALSE_PASS');
console.log('GAME_ARTIST_R9D_ART_PARTS_REFERENCE_AUDITED');
console.log(JSON.stringify(result));
console.log('R9D_ASSET_RELEASE_BLOCKED: actual alpha PNGs not archived/verified; poses not pixel-qualified');
