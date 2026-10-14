extends Node2D
## R7 atmospheric spirit-lantern world. Original deterministic vector geometry:
## ink-wash mountains, isometric shrine, reed silhouettes, moon mist and motes.
## This script is a gameplay-context art layer, not generative AI imagery.
@export var front_layer: bool = false
var elapsed: float = 0.0

func _process(delta: float) -> void:
    elapsed = fmod(elapsed + delta, 2.0)
    queue_redraw()

func _polygon(points: PackedVector2Array, color: Color) -> void:
    draw_colored_polygon(points, color)

func _ellipse(center: Vector2, rx: float, ry: float, color: Color, points: int = 60) -> void:
    var verts := PackedVector2Array()
    for i in range(points):
        var a: float = TAU * float(i) / float(points)
        verts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
    draw_colored_polygon(verts, color)

func _ellipse_line(center: Vector2, rx: float, ry: float, color: Color, thickness: float = 1.0) -> void:
    var verts := PackedVector2Array()
    for i in range(65):
        var a: float = TAU * float(i) / 64.0
        verts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
    draw_polyline(verts, color, thickness, true)

func _twig(anchor: Vector2, reach: float, side: float) -> void:
    var ink := Color("#152334")
    draw_line(anchor, anchor + Vector2(side * reach, -reach * 1.4), ink, 4.0, true)
    draw_line(anchor + Vector2(side * reach * 0.36, -reach * 0.52), anchor + Vector2(side * reach * 0.92, -reach * 0.92), ink, 2.0, true)
    draw_line(anchor + Vector2(side * reach * 0.60, -reach * 0.88), anchor + Vector2(-side * reach * 0.18, -reach * 1.22), ink, 2.0, true)

func _rock(origin: Vector2, scale_factor: float) -> void:
    var s: float = scale_factor
    _polygon(PackedVector2Array([
        origin + Vector2(-20, 2) * s, origin + Vector2(-14, -15) * s,
        origin + Vector2(2, -22) * s, origin + Vector2(20, -9) * s,
        origin + Vector2(27, 4) * s, origin + Vector2(8, 12) * s
    ]), Color("#233044"))
    _polygon(PackedVector2Array([
        origin + Vector2(-14, -15) * s, origin + Vector2(2, -22) * s,
        origin + Vector2(20, -9) * s, origin + Vector2(0, -8) * s
    ]), Color("#354455"))
    draw_line(origin + Vector2(-4, -19) * s, origin + Vector2(0, -8) * s, Color("#6a7874"), 1.1, true)

func _grass(anchor: Vector2, direction: float, scale_factor: float) -> void:
    var c := Color("#38564c")
    draw_line(anchor, anchor + Vector2(direction * 7, -25) * scale_factor, c, 2.0, true)
    draw_line(anchor, anchor + Vector2(direction * -8, -21) * scale_factor, c, 1.5, true)
    draw_line(anchor, anchor + Vector2(direction * 13, -13) * scale_factor, Color("#507465"), 1.3, true)

func _sky() -> void:
    # Background pixels and atmospheric grain are provided by Atmosphere.
    # Close the distant ridge *below* its silhouette. The former polygon
    # started at y=0 and hid the entire sky shader despite valid compilation.
    _polygon(PackedVector2Array([
        Vector2(0, 228), Vector2(75, 254), Vector2(135, 222),
        Vector2(222, 264), Vector2(296, 233), Vector2(360, 254),
        Vector2(448, 236), Vector2(512, 250), Vector2(512, 352),
        Vector2(0, 352)
    ]), Color("#111c2b"))
    _polygon(PackedVector2Array([
        Vector2(0, 264), Vector2(55, 210), Vector2(116, 249),
        Vector2(171, 192), Vector2(218, 241), Vector2(282, 208),
        Vector2(324, 257), Vector2(384, 207), Vector2(460, 244),
        Vector2(512, 195), Vector2(512, 340), Vector2(0, 340)
    ]), Color("#142234"))
    _polygon(PackedVector2Array([
        Vector2(0, 309), Vector2(75, 259), Vector2(130, 303),
        Vector2(206, 268), Vector2(277, 310), Vector2(356, 267),
        Vector2(429, 301), Vector2(512, 253), Vector2(512, 370), Vector2(0, 370)
    ]), Color("#19283a"))
    for i in range(5):
        var density: float = 0.025 + float(i) * 0.010
        draw_rect(Rect2(Vector2(0, 266 + i * 12), Vector2(512, 17)), Color(0.28, 0.50, 0.56, density))
    _ellipse(Vector2(404, 100), 48.0, 48.0, Color(0.25, 0.66, 0.74, 0.025))
    _ellipse(Vector2(404, 100), 26.0, 26.0, Color("#8fa49e"))
    _ellipse(Vector2(413, 94), 25.0, 25.0, Color("#101a29"))
    _twig(Vector2(17, 333), 95.0, 1.0)
    _twig(Vector2(502, 325), 105.0, -1.0)
    _twig(Vector2(56, 356), 48.0, 1.0)
    _twig(Vector2(469, 347), 61.0, -1.0)

func _shrine() -> void:
    _polygon(PackedVector2Array([
        Vector2(0, 363), Vector2(246, 318), Vector2(512, 366),
        Vector2(512, 512), Vector2(0, 512)
    ]), Color("#111b2a"))
    for i in range(8):
        var x: float = 20.0 + float(i) * 70.0
        draw_line(Vector2(x, 427), Vector2(x - 16.0, 512), Color("#233245"), 1.0)
    _ellipse(Vector2(260, 409), 181.0, 44.0, Color(0.0, 0.02, 0.06, 0.72))
    # Faceted isometric ritual dais, built as solids rather than a flat circle.
    _polygon(PackedVector2Array([
        Vector2(64, 390), Vector2(256, 337), Vector2(450, 390),
        Vector2(450, 418), Vector2(256, 473), Vector2(64, 418)
    ]), Color("#182b38"))
    _polygon(PackedVector2Array([
        Vector2(64, 390), Vector2(256, 337),
        Vector2(450, 390), Vector2(256, 447)
    ]), Color("#354a51"))
    _polygon(PackedVector2Array([
        Vector2(64, 390), Vector2(256, 447),
        Vector2(256, 473), Vector2(64, 418)
    ]), Color("#1c3039"))
    _polygon(PackedVector2Array([
        Vector2(256, 447), Vector2(450, 390),
        Vector2(450, 418), Vector2(256, 473)
    ]), Color("#152934"))
    # Inset concentric stone rims preserve the top-down isometric reading.
    _ellipse_line(Vector2(256, 391), 147.0, 43.0, Color("#63766c"), 2.0)
    _ellipse_line(Vector2(256, 391), 126.0, 35.0, Color("#2a555a"), 1.5)
    _ellipse_line(Vector2(256, 391), 96.0, 25.0, Color("#325d62"), 1.0)
    _ellipse(Vector2(256, 388), 78.0, 20.0, Color(0.0, 0.05, 0.08, 0.70))
    # Low-energy cyan bounce from the spirit fire; no fake full-scene bloom.
    var pulse: float = 0.88 + 0.12 * sin(elapsed * TAU)
    for i in range(8, 0, -1):
        var factor: float = float(i) / 8.0
        _ellipse(Vector2(256, 387), 110.0 * factor, 30.0 * factor, Color(0.15, 0.86, 0.84, 0.013 * pulse))
    for i in range(16):
        var a: float = TAU * float(i) / 16.0
        var origin: Vector2 = Vector2(256.0 + cos(a) * 135.0, 391.0 + sin(a) * 38.0)
        var tip: Vector2 = origin + Vector2(cos(a) * 11.0, sin(a) * 3.0)
        draw_line(origin, tip, Color(0.45, 0.87, 0.81, 0.45), 1.2, true)
    draw_line(Vector2(174, 397), Vector2(141, 409), Color("#60756d"), 1.4, true)
    draw_line(Vector2(332, 374), Vector2(379, 385), Color("#60756d"), 1.3, true)
    _rock(Vector2(89, 372), 0.78)
    _rock(Vector2(436, 374), 0.86)
    _rock(Vector2(154, 459), 0.63)
    _rock(Vector2(402, 457), 0.59)

func _motes() -> void:
    # Deterministic motes move independently of flame pose and do not read OS RNG.
    for i in range(11):
        var k: float = float(i)
        var phase: float = elapsed * (0.53 + k * 0.017) + k * 1.71
        var px: float = 256.0 + sin(phase * 2.4) * (25.0 + k * 4.0)
        var py: float = 252.0 - fmod(elapsed * (12.0 + k) + k * 23.0, 145.0)
        var alpha: float = 0.11 + 0.11 * (0.5 + 0.5 * sin(phase * 3.2))
        draw_circle(Vector2(px, py), 1.0 + float(i % 3) * 0.5, Color(0.47, 0.99, 0.89, alpha))

func _foreground() -> void:
    # Deliberate framing: sparse grasses and stone chips occlude the dais edge.
    _grass(Vector2(34, 455), 1.0, 1.4)
    _grass(Vector2(59, 489), 1.0, 0.95)
    _grass(Vector2(460, 455), -1.0, 1.6)
    _grass(Vector2(483, 481), -1.0, 1.0)
    _rock(Vector2(34, 504), 1.45)
    _rock(Vector2(490, 496), 1.14)
    _motes()
    # Dark corner shapes help the flame and golden roof remain focal.
    _polygon(PackedVector2Array([
        Vector2(0, 0), Vector2(22, 0), Vector2(0, 292)
    ]), Color(0.02, 0.03, 0.07, 0.30))
    _polygon(PackedVector2Array([
        Vector2(490, 0), Vector2(512, 0), Vector2(512, 310)
    ]), Color(0.02, 0.03, 0.07, 0.28))

func _draw() -> void:
    if front_layer:
        _foreground()
    else:
        _sky()
        _shrine()
