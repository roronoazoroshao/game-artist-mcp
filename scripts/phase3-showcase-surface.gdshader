shader_type canvas_item;
// Low-amplitude mineral/paper grain, stable in screen-space.
// Operates on real Godot CanvasItem material pixels, not PNG postprocess.
float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float texture_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2(i);
    float b = hash2(i + vec2(1.0, 0.0));
    float c = hash2(i + vec2(0.0, 1.0));
    float d = hash2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void fragment() {
    float veins = texture_noise(FRAGCOORD.xy / 8.0);
    float pebbles = texture_noise(FRAGCOORD.xy / 2.3);
    float dust = hash2(floor(FRAGCOORD.xy));
    float patina = 0.83 + 0.23 * veins + 0.045 * pebbles + 0.027 * dust;
    vec4 ink = COLOR;
    COLOR = vec4(clamp(ink.rgb * patina, vec3(0.0), vec3(1.0)), ink.a);
}
