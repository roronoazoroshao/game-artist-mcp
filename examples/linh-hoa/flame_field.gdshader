shader_type canvas_item;
render_mode unshaded, blend_mix;

// Engine-native art-direction controls. Flow travels upward through the shape.
uniform float phase = 0.0;
uniform float phase_bias = 0.0;
uniform float hue_bias = 0.0;
uniform float heat = 1.0;
uniform float plume_variant = 0.0;

float hash21(vec2 p) {
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
}
float noise21(vec2 p) {
    vec2 q=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
    return mix(mix(hash21(q),hash21(q+vec2(1.,0.)),u.x),
               mix(hash21(q+vec2(0.,1.)),hash21(q+vec2(1.,1.)),u.x),u.y);
}
float fbm(vec2 p) {
    float a=0.53, v=0.0;
    for(int k=0;k<4;k++) {
        v+=a*noise21(p);
        p=p*2.03+vec2(19.1,31.7);
        a*=0.48;
    }
    return v;
}
void fragment() {
    vec2 uv=UV;
    float t=phase+phase_bias;
    float h=clamp(1.0-uv.y,0.0,1.0);
    // Animated, asymmetric S-shaped brush silhouette: broad lower belly,
    // then a narrowing upper tongue rather than a translucent fog volume.
    float scroll=h*h;
    // Shared phase with native Bézier ribbons: rooted waves, broad slow body,
    // with faster narrow tongues lagging behind. No unrelated rigid whole-sprite sway.
    float shared_bend=0.036*pow(h,0.84)*(sin(h*3.6-1.65*t)-sin(-1.65*t));
    float center=shared_bend+scroll*(-0.095+0.040*sin(5.8*h-1.28*t+0.2)+0.029*sin(10.1*h+0.91*t));
    center+=(plume_variant*0.043)*h;
    float base_width=(0.13+0.44*pow(h,0.62))*pow(1.0-h,0.83);
    float width=base_width*(1.0+0.043*sin(2.28*t-h*2.9))*(1.0+0.07*sin(h*15.3-3.25*t)+0.04*sin(h*25.1+2.3*t));
    width=max(0.005,width);
    float x=uv.x-0.5-center;
    float q=abs(x)/width;
    // High-frequency drift belongs to painted pigment, not the actual
    // silhouette: keep hard, readable contours at 64px.
    float bound=1.0+0.05*sin(20.0*h-3.4*t+7.0*uv.x);
    float silhouette=1.0-smoothstep(0.91*bound,1.038*bound,q);
    float foot=smoothstep(-0.015,0.065,h);
    silhouette*=foot;

    float flow=fbm(vec2(uv.x*8.5+h*1.5,h*11.0-2.7*t));
    float flow_fine=fbm(vec2(uv.x*19.0-h*4.0,h*20.0-4.0*t));
    float veinline=sin(h*32.0-5.8*t+flow*7.0+uv.x*14.0);
    float inner=1.0-smoothstep(0.16,0.73,q);
    float heart=1.0-smoothstep(0.09,0.36,q);
    vec3 nocturne=vec3(0.015,0.115,0.215);
    vec3 sea=vec3(0.005,0.43,0.56);
    vec3 jade=vec3(0.016,0.88,0.75);
    vec3 mint=vec3(0.52,1.0,0.84);
    vec3 pearl=vec3(0.88,1.0,0.91);
    vec3 amber=vec3(1.0,0.72,0.36);

    float belly=1.0-smoothstep(0.22,0.94,q);
    vec3 col=mix(nocturne,sea,belly);
    col=mix(col,jade,0.62*inner+0.13*(flow-0.2));
    col=mix(col,mint,0.73*heart);
    float luminous_core=pow(heart,1.7)*(0.46-0.23*h)*(0.94+0.06*sin(t*2.28));
    col=mix(col,pearl,luminous_core);
    // Gold spirit seed is a narrow living knot near the base, never a static spear.
    float gold_offset=0.075*sin(h*9.5-1.36*t+0.4)+0.027*cos(h*16.0+t);
    float gold_q=abs(x-gold_offset)/width;
    float golden_seed=(1.0-smoothstep(0.06,0.36,gold_q))*(1.0-smoothstep(0.24,0.69,h));
    col=mix(col,amber,0.76*golden_seed);
    // Fine painted directionality, clear inner-negative space and cold-edge rim.
    float dim_pocket=smoothstep(0.62,0.83,flow)*smoothstep(0.15,0.48,q)*(1.0-smoothstep(0.85,1.0,q));
    col=mix(col,sea,0.48*dim_pocket);
    float vein=smoothstep(0.60,0.94,veinline)*smoothstep(0.21,0.46,q)*(1.0-smoothstep(0.75,1.0,q));
    col+=jade*vein*0.14;
    col+=vec3(0.03,0.04,0.03)*(flow_fine-0.5);
    float rim=exp(-pow((q-0.78)*13.0,2.0))*(0.45+0.25*flow);
    col+=vec3(0.0,0.14,0.16)*rim;
    col=mix(col,sea,hue_bias*0.26);

    float a=clamp(silhouette*heat,0.0,1.0);
    a*=1.0-0.13*smoothstep(0.71,1.0,h);
    COLOR=vec4(col,a);
}
