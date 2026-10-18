import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import pngjs from 'pngjs';
import {createHash} from 'node:crypto';
const {PNG}=pngjs;
const root=resolve('examples/spirit-lantern/generated');
const variants=[
 ['R9D06_BASELINE','r9d-06-baseline-godot'],
 ['R9D07_POLISHED','r9d-godot'],
 ['R9D07_FADE_ONLY','r9d-07-ablation-fade-godot'],
 ['R9D07_LIGHT_ONLY','r9d-07-ablation-light-godot'],
 ['R9D07_SOFT_60HZ','r9d-07-ablation-soft-godot']
];
const frames={64:[0,8,9,10,11,12,13,14,15,233,234,235,236,237,238,239],
 128:[0,8,10,12,14,16,232,234,236,238]};
const manifest=[];
for(const size of [64,128]){
 const gap=4,ticks=frames[size],width=ticks.length*(size+gap)+gap;
 const height=variants.length*(size+gap)+gap;
 const out=new PNG({width,height,colorType:6});
 out.data.fill(0);
 for(let i=0;i<out.data.length;i+=4){
  out.data[i]=12;out.data[i+1]=17;out.data[i+2]=21;out.data[i+3]=255;
 }
 for(let row=0;row<variants.length;row++){
  const [variant,dir]=variants[row];
  for(let col=0;col<ticks.length;col++){
   const tick=ticks[col],filename='tick-'+String(tick).padStart(4,'0')+'-'+size+'.png';
   const bytes=await readFile(join(root,dir,'temporal',filename));
   const im=PNG.sync.read(bytes,{checkCRC:true});
   if(im.width!==size||im.height!==size)throw Error('R9D07_ABLATION_SHEET_BAD_FRAME '+variant);
   const x0=gap+col*(size+gap),y0=gap+row*(size+gap);
   for(let y=0;y<size;y++){
    const srcStart=y*size*4,destStart=((y+y0)*width+x0)*4;
    im.data.copy(out.data,destStart,srcStart,srcStart+size*4);
   }
   manifest.push({variant,size,tick,timeMs:Number((tick*1000/120).toFixed(3)),
    row,col,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
 }
 const name='r9d-07-ablation-contact-'+size+'.png';
 await writeFile(join(root,'r9d-godot',name),PNG.sync.write(out));
}
await writeFile(join(root,'r9d-godot','r9d-07-ablation-contact-index.json'),
 JSON.stringify({
  status:'REAL_GODOT_FRAMEBUFFER_CONTACT_SHEET',
  originalSourcesEdited:false,physicalDisplayFramePacingVerified:false,
  artisticReview:'UNSCORED',commercialRightsCleared:false,exportAllowed:false,
  rowOrder:variants.map(([variant])=>variant),sourceHz:120,
  captures:manifest
 },null,2)+'\n');
console.log('R9D07_ABLATION_REAL_GODOT_CONTACT_SHEETS_WRITTEN');
