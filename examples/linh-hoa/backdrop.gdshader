shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float phase=0.0;
float hash21(vec2 p) { return fract(sin(dot(p,vec2(67.1,307.9)))*43758.545); }
float noise21(vec2 p){
 vec2 q=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
 return mix(mix(hash21(q),hash21(q+vec2(1.0,0.0)),u.x),mix(hash21(q+vec2(0.0,1.0)),hash21(q+vec2(1.0,1.0)),u.x),u.y);
}
float fbm(vec2 p) {
 float s=0.0,a=0.5;
 for(int j=0;j<4;j++){s+=a*noise21(p);p*=2.07;a*=0.49;}
 return s;
}
void fragment() {
 vec2 uv=UV;
 float t=phase;
 vec3 midnight=vec3(0.025,0.064,0.116), ocean=vec3(0.023,0.11,0.155);
 vec3 col=mix(midnight,ocean,smoothstep(0.13,1.0,uv.y));
 float godray=max(0.0,1.0-length((uv-vec2(0.49,0.43))*vec2(1.6,1.8)));
 col+=vec3(0.0,0.055,0.067)*pow(godray,3.0);
 // Painterly distant shadowed ridgelines, intentionally recessive to the foreground ritual.
 float n=fbm(vec2(uv.x*6.0,3.7));
 float ridge=0.42+0.07*sin(uv.x*13.0)+0.13*(n-0.48);
 float cliffs=smoothstep(ridge-0.05,ridge+0.05,uv.y);
 col=mix(col,vec3(0.023,0.074,0.11),cliffs*0.52);
 float fog=fbm(vec2(uv.x*3.9+t*0.024,uv.y*11.0-t*0.035));
 float fog_belt=exp(-pow((uv.y-(0.43+fog*0.035))*12.0,2.0));
 col+=vec3(0.018,0.073,0.087)*fog_belt*0.5;
 // Very faint celestial glyph behind the focal effect, not a competing UI halo.
 vec2 orb=(uv-vec2(0.51,0.39))*vec2(1.0,1.78);
 float r=length(orb);
 float outer=exp(-pow((r-0.285)*220.0,2.0));
 float inner=exp(-pow((r-0.242)*250.0,2.0));
 col+=vec3(0.08,0.22,0.23)*(outer*0.085+inner*0.045);
 // Irregular cold sky ink wash; no downloaded photographic texture.
 float grain=fbm(uv*vec2(18.0,12.0));
 col+=vec3(0.012,0.018,0.020)*(grain-0.45);
 COLOR=vec4(col,1.0);
}
