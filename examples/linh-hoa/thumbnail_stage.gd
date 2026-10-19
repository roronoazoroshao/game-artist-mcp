extends Node2D
var edge: int = 64
func _draw() -> void:
    var n: float = float(edge)
    draw_rect(Rect2(0, 0, n, n), Color("#111e2c"))
    var ground := PackedVector2Array()
    for i in range(49):
        var a: float = TAU * float(i) / 48.0
        ground.append(Vector2(n * 0.5 + cos(a) * n * 0.41, n * 0.81 + sin(a) * n * 0.15))
    draw_colored_polygon(ground, Color("#243341"))
