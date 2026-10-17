#!/usr/bin/env python3
"""Independent real Krita semantic round-trip gate for actual R9d master.

Normalizes only harmless transparent-edge cropping (including shifted x/y)
and ZIP-local PNG renaming. Every layer's VISIBLE world-space RGBA pixels,
owner group, visibility and transparency must remain unchanged.
Merged previews may have a separately reported, bounded 1-LSB compositor
variance. Nothing here authenticates Adobe rights or artistic quality.
"""
import io
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from hashlib import sha256
from pathlib import Path
from PIL import Image

ALLOWED_IDS=['body_base','flame_flame_a','flame_flame_b',
             'flame_flame_c','flame_flame_d','talisman_left_base',
             'talisman_right_base','tassel_base']
EXPECTED_OWNERS=['rig_body','rig_flame','rig_talisman_left',
                 'rig_talisman_right','rig_tassel']
MAX_BYTES=24*1024*1024
MAX_DECODED=64*1024*1024

def reject(why):
    raise ValueError('R9D_KRITA_SEMANTIC_REJECTED: '+why)

def read_ora(path):
    raw=Path(path).read_bytes()
    if len(raw)<100 or len(raw)>MAX_BYTES: reject('ORA size')
    with zipfile.ZipFile(io.BytesIO(raw)) as ar:
        entries=ar.infolist()
        if len(entries)<10 or len(entries)>64:reject('unexpected ZIP entries')
        names=[x.filename for x in entries]
        if len(names)!=len(set(names)) or sum(i.file_size for i in entries)>MAX_DECODED:reject('ZIP bounds/duplicate')
        for entry in entries:
            name=entry.filename
            if not name or name.startswith('/') or '..' in name.split('/') or '\\' in name:
                reject('untrusted archive path')
            if (entry.external_attr>>16)&0o170000==0o120000:reject('ZIP symlink')
        if ar.testzip():reject('ZIP CRC failed')
        if ar.read('mimetype')!=b'image/openraster':reject('wrong ORA type')
        x=ar.read('stack.xml')
        if len(x)>65536 or b'<!' in x or b'&' in x or b'<?' in x[32:]:
            reject('unsafe XML or entities')
        root=ET.fromstring(x)
        if root.tag!='image':reject('wrong XML root')
        canvas=(int(root.attrib['w']),int(root.attrib['h']))
        if canvas!=(1024,1280):reject('wrong master canvas')
        layers={};groups=[]
        def walk(node,parent=(),depth=0):
            if depth>5:reject('deep XML groups')
            for item in node:
                if item.tag=='stack':
                    label=item.attrib.get('name','')
                    if label:
                        groups.append(label)
                        walk(item,parent+(label,),depth+1)
                    else:walk(item,parent,depth+1)
                elif item.tag=='layer':
                    label=item.attrib.get('name','')
                    src=item.attrib.get('src','')
                    if label not in ALLOWED_IDS or label in layers or not re.fullmatch(r'data/[A-Za-z0-9_.-]+\.png',src):
                        reject('missing/invalid layer or external image source')
                    if item.attrib.get('composite-op','svg:src-over')!='svg:src-over':reject('unsupported blend')
                    if src not in names:reject('missing layer PNG')
                    img=Image.open(io.BytesIO(ar.read(src))).convert('RGBA')
                    img.load()
                    if img.width<1 or img.height<1 or img.width*img.height>4194304:
                        reject('layer resource size')
                    layers[label]={'image':img,'x':int(item.attrib.get('x',0)),
                     'y':int(item.attrib.get('y',0)),
                     'visible':item.attrib.get('visibility','visible')=='visible',
                     'opacity':float(item.attrib.get('opacity','1')),
                     'parent':parent,'file':src}
                else:reject('unsupported OpenRaster stack element')
        for top in root:
            if top.tag=='stack':walk(top)
        if list(layers)!=ALLOWED_IDS or groups!=EXPECTED_OWNERS:reject('part owner/order mismatch')
        preview=Image.open(io.BytesIO(ar.read('mergedimage.png'))).convert('RGBA')
        preview.load()
        if preview.size!=canvas:reject('merged image wrong canvas')
        return {'sha256':sha256(raw).hexdigest(),'canvas':canvas,
                'layers':layers,'groups':groups,'merged':preview}

def canvas_layer(img,x,y,canvas):
    if x<0 or y<0 or x+img.width>canvas[0] or y+img.height>canvas[1]:
        reject('layer geometry outside master')
    result=Image.new('RGBA',canvas)
    result.paste(img,(x,y))
    return result

def layer_semantic_delta(src,src_x,src_y,dst,dst_x,dst_y,canvas):
    source=canvas_layer(src,src_x,src_y,canvas).tobytes()
    target=canvas_layer(dst,dst_x,dst_y,canvas).tobytes()
    changed=maximum=0
    for i in range(0,len(source),4):
        a=source[i+3];b=target[i+3]
        if a!=b or (a>0 and source[i:i+3]!=target[i:i+3]):
            changed+=1
            maximum=max(maximum,max(abs(source[i+j]-target[i+j]) for j in range(4)))
    return {'changedVisiblePixels':changed,'maxChannelDelta':maximum}

def preview_delta(left,right):
    if left.size!=right.size:reject('preview canvases mismatch')
    a=left.tobytes();b=right.tobytes()
    changed=maximum=0
    for i in range(0,len(a),4):
        diff=max(abs(a[i+j]-b[i+j]) for j in range(4))
        if diff:changed+=1;maximum=max(maximum,diff)
    return {'changedPixels':changed,'maxChannelDelta':maximum}

def verify(source,exported,reopened,report_path):
    result={'stage':'REAL_KRITA_5_2_R9D_1024_MASTER',
      'layerSemanticWorldPixelsExact':False,'editorStatus':'UNVERIFIED',
      'nativeEditorMasksVerified':False,'providerOriginalAttested':False,
      'artisticReview':'UNSCORED','rightsVerified':False,'exportAllowed':False}
    try:
        a=read_ora(source);b=read_ora(exported)
        changed={}
        for name in ALLOWED_IDS:
            x=a['layers'][name];y=b['layers'][name]
            if x['visible']!=y['visible'] or x['parent']!=y['parent'] or abs(x['opacity']-y['opacity'])>1/255+0.000001:
                reject('layer group/visibility/opacity changed: '+name)
            changed[name]=layer_semantic_delta(x['image'],x['x'],x['y'],
                y['image'],y['x'],y['y'],a['canvas'])
            if changed[name]['changedVisiblePixels']:
                reject('actual visible pixels changed: '+name)
        reopened_img=Image.open(reopened).convert('RGBA');reopened_img.load()
        merged=preview_delta(a['merged'],b['merged'])
        rendered=preview_delta(b['merged'],reopened_img)
        if merged['maxChannelDelta']>1 or rendered['maxChannelDelta']!=0:
            reject('editor changed merged preview beyond 1-LSB or reopened PNG')
        result.update({
          'editorStatus':'SEMANTIC_SOURCE_EXACT_PREVIEW_BOUNDED',
          'sourceOraSha256':a['sha256'],'kritaOraSha256':b['sha256'],
          'canvas':a['canvas'],'independentEditableLayers':len(changed),
          'layerSemanticWorldPixelsExact':True,
          'perLayerPixelDelta':changed,
          'mergedPreviewSourceVsKrita':merged,
          'mergedPreviewKritaVsReopened':rendered,
          'previewPixelsExact':merged['maxChannelDelta']==0,
          'technicalInteropAcceptWithWarning':True,
          'artisticReview':'UNSCORED','exportAllowed':False
        })
        good=True
    except Exception as error:
        result.update({'editorStatus':'FAIL','error':str(error)[:420]})
        good=False
    Path(report_path).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2),flush=True)
    if not good:
        print('R9D_REAL_KRITA_INTEROP_NOT_VERIFIED',file=sys.stderr)
        return 1
    print('R9D_KRITA_EIGHT_LAYER_WORLD_RGBA_EXACT')
    return 0

if __name__=='__main__':
    if len(sys.argv)!=5:
        print('Usage: script source.ora exported.ora reopened.png report.json',file=sys.stderr)
        sys.exit(2)
    sys.exit(verify(*(Path(p) for p in sys.argv[1:])))
