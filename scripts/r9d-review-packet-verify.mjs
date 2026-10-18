#!/usr/bin/env node
import {resolve} from 'node:path';
import {verifyR9dReviewPacket} from '../src/ai-art/r9d-review-packet-verify.mjs';
const args=process.argv.slice(2);
function option(flag){
 const idx=args.indexOf('--'+flag);
 if(idx<0||idx+1>=args.length||args[idx+1].startsWith('--'))throw Error('missing --'+flag);
 return args[idx+1];
}
async function main(){
 const root=resolve(option('root'));
 const expectedSourceHead=option('source-head');
 const status=await verifyR9dReviewPacket({root,expectedSourceHead});
 process.stdout.write(JSON.stringify(status,null,2)+'\n');
}
main().catch(e=>{
 process.stderr.write('R9D_BLIND_REVIEW_KIT_UNVERIFIED: '+e.message+'\n');
 process.exitCode=1;
});
