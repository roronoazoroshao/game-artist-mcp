extends Node2D
## Linh Hỏa / Thanh Liên U Hỏa. Pure editable CanvasItem geometry, no image model.
## Origin is the isometric ground-contact point. Approx. visual bounds ±76 x -184..22.
@export_range(0.0, 2.0, 0.05) var intensity: float = 1.0
@export var time_override: float = -1.0
var elapsed: float = 0.0

const INK: Color = Color("#112b46")
const DEEP: Color = Color("#18334f")
const TEAL: Color = Color("#198fa4")
const CYAN: Color = Color("#32dec4")
const MILK: Color = Color("#d9fff1")
const GOLD: Color = Color("#e9be81")

func _process(delta: float) -> void:
    if time_override < 0.0:
        elapsed += delta
    queue_redraw()

func phase() -> float:
    return time_override if time_override >= 0.0 else elapsed

func _ellipse(center: Vector2, a: float, b: float, color: Color, filled: bool = false, thickness: float = 1.0) -> void:
    var pts := PackedVector2Array()
    for i in range(49):
        var theta: float = float(i) * TAU / 48.0
        pts.append(center + Vector2(cos(theta) * a, sin(theta) * b))
    if filled:
        draw_colored_polygon(pts, color)
    else:
        draw_polyline(pts, color, thickness, true)

func _catmull(anchors: Array[Vector2], segments: int = 7) -> PackedVector2Array:
    var pts := PackedVector2Array()
    var n: int = anchors.size()
    for i in range(n):
        var a: Vector2 = anchors[(i - 1 + n) % n]
        var b: Vector2 = anchors[i]
        var c: Vector2 = anchors[(i + 1) % n]
        var d: Vector2 = anchors[(i + 2) % n]
        for step in range(segments):
            var t: float = float(step) / float(segments)
            var t2: float = t * t
            var t3: float = t2 * t
            pts.append(0.5 * ((b * 2.0) + (-a + c) * t + (a * 2.0 - b * 5.0 + c * 4.0 - d) * t2 + (-a + b * 3.0 - c * 3.0 + d) * t3))
    return pts

func _poly(anchors: Array[Vector2], color: Color, smooth: int = 7) -> void:
    draw_colored_polygon(_catmull(anchors, smooth), color)

func _draw() -> void:
    var t: float = phase()
    var breath: float = 1.0 + 0.045 * sin(t * 3.8)
    var sway: float = sin(t * 1.7) * 0.033
    # The floor disc is flattened to an isometric ellipse, not a front-facing circle.
    _ellipse(Vector2(0, 9), 78, 24, Color(0.01, 0.08, 0.12, 0.5), true)
    _ellipse(Vector2(0, 5), 61, 16, Color(0.10, 0.74, 0.74, 0.16), true)
    _ellipse(Vector2(0, 4), 61, 16, Color(0.25, 0.81, 0.73, 0.50), false, 1.5)
    _ellipse(Vector2(0, 4), 46, 11.5, Color(0.95, 0.73, 0.44, 0.47), false, 1.1)
    for i in range(8):
        var angle: float = TAU * float(i) / 8.0
        var pos: Vector2 = Vector2(cos(angle) * 59.0, 4.0 + sin(angle) * 15.0)
        var spoke: Vector2 = Vector2(cos(angle) * 48.0, 4.0 + sin(angle) * 11.0)
        draw_line(spoke, pos, Color(0.99, 0.78, 0.50, 0.62), 1.25, true)
        draw_circle(pos, 1.4, GOLD)
    # Low-frequency translucent field; local color contrast maintained by opaque flame.
    for ring in range(5, 0, -1):
        draw_circle(Vector2(0, -70), float(ring) * 17.0, Color(0.06, 0.72, 0.75, 0.012 * intensity))
    draw_set_transform(Vector2(0, -1.0 + sin(t * 4.0) * 1.8), sway, Vector2(breath, breath))
    var flick: float = sin(t * 4.8) * 5.5 + sin(t * 7.2 + 0.8) * 1.7
    # Back-facing wisps and silhouette: asymmetry drives a recognisable fire shape.
    _poly([Vector2(-20, -10), Vector2(-57, -38), Vector2(-47, -67), Vector2(-63, -103), Vector2(-30, -90), Vector2(-13, -128), Vector2(-11, -70), Vector2(17, -25)], Color("#146377"))
    _poly([Vector2(23, -10), Vector2(55, -29), Vector2(48, -58), Vector2(62, -84), Vector2(30, -78), Vector2(22, -116), Vector2(5, -60)], Color("#176b83"))
    _poly([Vector2(-36, -10), Vector2(-55, -41), Vector2(-44, -76), Vector2(-34, -102), Vector2(-35, -137), Vector2(-12, -115), Vector2(2, -168 + flick), Vector2(19, -127), Vector2(36, -135), Vector2(26, -98), Vector2(48, -70), Vector2(37, -32), Vector2(27, -13), Vector2(0, -4)], INK, 9)
    # Opaque outlined flame bodies rather than uniform gradients which vanish at 64px.
    _poly([Vector2(-31, -11), Vector2(-48, -43), Vector2(-34, -78), Vector2(-29, -115), Vector2(-20, -101), Vector2(2, -151 + flick), Vector2(17, -112), Vector2(30, -121), Vector2(20, -87), Vector2(39, -64), Vector2(29, -32), Vector2(18, -11), Vector2(0, -7)], TEAL, 8)
    _poly([Vector2(-19, -9), Vector2(-31, -45), Vector2(-15, -77), Vector2(-20, -105), Vector2(-3, -91), Vector2(8, -127 + flick * 0.45), Vector2(20, -94), Vector2(25, -55), Vector2(14, -17), Vector2(1, -8)], CYAN, 8)
    _poly([Vector2(-11, -10), Vector2(-18, -45), Vector2(-7, -74), Vector2(-9, -94), Vector2(5, -82), Vector2(9, -107), Vector2(17, -65), Vector2(13, -32), Vector2(5, -12)], MILK, 7)
    _poly([Vector2(-7, -10), Vector2(-10, -29), Vector2(-3, -56), Vector2(4, -73), Vector2(11, -48), Vector2(10, -17), Vector2(2, -9)], Color("#fbe4aa"), 6)
    # The two curling blue lotus petals reinforce a xianxia identity at larger sizes.
    _poly([Vector2(-5, -7), Vector2(-36, -13), Vector2(-47, -32), Vector2(-20, -27), Vector2(0, -13)], DEEP)
    _poly([Vector2(5, -7), Vector2(40, -13), Vector2(46, -32), Vector2(17, -27), Vector2(0, -13)], DEEP)
    _poly([Vector2(-7, -11), Vector2(-32, -18), Vector2(-38, -25), Vector2(-16, -23), Vector2(2, -13)], Color("#229daf"))
    _poly([Vector2(6, -11), Vector2(32, -18), Vector2(36, -24), Vector2(16, -23), Vector2(-2, -13)], Color("#219daf"))
    draw_line(Vector2(-27, -21), Vector2(-5, -12), Color("#88f7ce"), 1.7, true)
    draw_line(Vector2(27, -21), Vector2(5, -12), Color("#88f7ce"), 1.7, true)
    draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
    # An occasional thin escaping tongue breaks the steady three-prong contour.
    var lash: float = sin(t * 2.8 + 0.4)
    draw_arc(Vector2(15.0 + lash * 6.0,-113.0), 23.0, -2.35, -0.67 + lash * 0.17, 17, Color(0.21,0.83,0.77,0.33), 1.5, true)
    # Sparse deterministic floating embers; no uncontrolled random flicker.
    for i in range(7):
        var seed: float = float(i) * 1.61803
        var h: float = fposmod(t * (17.0 + float(i % 3) * 4.0) + seed * 21.0, 149.0)
        var x: float = sin(seed * 4.7 + t * 1.1) * (23.0 + float(i % 4) * 9.0)
        var y: float = -22.0 - h
        var a: float = sin(PI * h / 149.0)
        if a > 0.12:
            draw_line(Vector2(x, y + 5.0), Vector2(x + 1.5, y), Color(0.18, 0.89, 0.77, a * 0.65), 1.0, true)
            draw_circle(Vector2(x + 1.5, y), 1.4 if i % 2 == 0 else 1.0, Color(0.98, 0.79, 0.52, a))
