shader_type canvas_item;
render_mode unshaded;

// Bounded deterministic procedural sky. No user textures, remote assets,
// random runtime seeds or copyrighted reference art.
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float value_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
    float v = 0.0;
    float weight = 0.50;
    for (int i = 0; i < 5; i++) {
        v += weight * value_noise(p);
        p = p * 2.06 + vec2(0.19, 0.47);
        weight *= 0.52;
    }
    return v;
}
void fragment() {
    vec2 uv = UV;
    float haze = fbm(uv * vec2(6.4, 9.1) + vec2(TIME * 0.009, 0.0));
    float fine = fbm(uv * vec2(23.0, 14.0) - vec2(TIME * 0.014, 0.0));
    vec3 top = vec3(0.013, 0.025, 0.058);
    vec3 horizon = vec3(0.046, 0.095, 0.121);
    vec3 col = mix(top, horizon, pow(uv.y, 1.35));
    float veil = smoothstep(0.36, 0.76, haze + uv.y * 0.16);
    veil *= smoothstep(0.13, 0.78, uv.y);
    col += vec3(0.053, 0.135, 0.119) * veil * 0.32;
    float strands = smoothstep(0.54, 0.84, fine);
    col += vec3(0.035, 0.100, 0.104) * strands * 0.18;
    float lantern_halo = exp(-dot((uv - vec2(0.50, 0.405)) * vec2(1.14, 1.0), (uv - vec2(0.50, 0.405)) * vec2(1.14, 1.0)) * 18.0);
    col += vec3(0.031, 0.105, 0.107) * lantern_halo * 0.38;
    float star_seed = hash21(floor(uv * vec2(284.0, 211.0)));
    float stars = step(0.998, star_seed) * (1.0 - smoothstep(0.1, 0.6, uv.y));
    col += vec3(0.41, 0.70, 0.66) * stars * 0.28;
    vec2 d = (uv - 0.5) * vec2(1.0, 1.04);
    float vignette = smoothstep(0.23, 0.73, length(d));
    col *= (1.0 - 0.50 * vignette);
    col += (hash21(FRAGCOORD.xy + floor(TIME * 6.0)) - 0.5) * 0.007;
    COLOR = vec4(clamp(col, vec3(0.0), vec3(1.0)), 1.0);
}
