shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float phase = 0.0;
uniform float phase_bias = 0.0;
uniform float hue_bias = 0.0;
uniform float heat = 1.0;
float hash2(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p) {
    vec2 i=floor(p); vec2 f=fract(p);
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash2(i),hash2(i+vec2(1,0)),u.x),
      mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p) {
    float v=0.0; float amp=0.5;
    for (int i=0;i<4;i++) { v += noise(p)*amp; p=p*2.04+vec2(17.2,11.7); amp*=0.5; }
    return v;
}
void fragment() {
    vec2 uv=UV;
    float y=1.0-uv.y;
    float t=phase+phase_bias;
    // Advected turbulence, not a static sprite rocking from side to side.
    float warp = fbm(vec2(uv.x*4.7+y*1.4, y*9.8-t*1.8));
    float strand = fbm(vec2(uv.x*10.5-1.7, y*13.1-t*2.9));
    float center=0.036*sin(y*6.0+t*1.4)+0.029*sin(y*11.0-t*1.8);
    center+=(warp-0.48)*0.075*y;
    float width=0.32*pow(max(0.0,1.0-y),0.76) + 0.018;
    width*=1.0+0.12*sin(y*16.0-t*3.6)+0.15*(strand-0.5);
    float x=uv.x-0.5-center;
    float contour=abs(x)/max(0.005,width);
    float scuff=(warp-0.5)*0.43+0.13*sin(y*21.0-t*3.8+uv.x*12.0);
    float mask=1.0-smoothstep(0.76,1.10,contour+scuff);
    // Moving pockets carve flame and soften the otherwise vector-sharp interior.
    float pocket=fbm(vec2(uv.x*14.0+sin(y*9.0)*0.4,y*15.5-t*3.5));
    float core=1.0-smoothstep(0.15,0.85,contour+0.19*(pocket-0.5));
    float flower=sin(uv.x*27.0+y*14.0-2.6*t+strand*6.0);
    float vein=smoothstep(0.60,0.92,flower)*mask*(0.15+0.31*y);
    vec3 ink=vec3(0.012,0.09,0.20);
    vec3 indigo=vec3(0.025,0.24,0.44);
    vec3 jade=vec3(0.015,0.70,0.74);
    vec3 teal=vec3(0.17,0.94,0.81);
    vec3 pearl=vec3(0.78,1.0,0.93);
    vec3 gold=vec3(1.0,0.78,0.42);
    vec3 col=mix(indigo,jade,1.0-smoothstep(0.23,0.91,contour));
    col=mix(col,teal,0.75*core+vein*0.16);
    col=mix(col,pearl,pow(core,3.8)*(0.42+0.11*pocket));
    col=mix(col,gold,pow(max(0.0,core),12.0)*(0.56-0.31*y));
    col=mix(col,ink,0.49*smoothstep(0.74,1.08,contour));
    col+=hue_bias*vec3(-0.02,0.05,0.12);
    float delicate=1.0-smoothstep(0.72,1.02,y);
    float alpha=clamp(mask*(0.91+0.09*core)*heat,0.0,1.0);
    alpha*=mix(1.0,0.78,delicate*0.13);
    COLOR=vec4(col,alpha);
}
