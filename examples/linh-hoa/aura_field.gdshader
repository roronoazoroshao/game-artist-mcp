shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float phase=0.0;
void fragment() {
    vec2 p=(UV-vec2(0.5,0.5))*vec2(1.0,1.38);
    float t=phase;
    float d=length(p);
    float glow=exp(-d*d*21.0);
    glow*=0.91+0.09*sin(t*3.4);
    float shroud=exp(-length((UV-vec2(0.5,0.80))*vec2(1.5,1.1))*6.0);
    float r=glow*0.13+shroud*0.07;
    COLOR=vec4(mix(vec3(0.035,0.68,0.72),vec3(0.49,0.95,0.73),shroud*0.5),min(0.34,r));
}
