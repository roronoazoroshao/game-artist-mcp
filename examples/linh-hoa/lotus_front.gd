extends Node2D
## The near lotus leaves occlude the flame foot to visually anchor it.
func _draw() -> void:
    var tips := [
        PackedVector2Array([Vector2(-3,-7),Vector2(-31,-14),Vector2(-51,-28),Vector2(-46,-12),Vector2(-24,1),Vector2(0,-4)]),
        PackedVector2Array([Vector2(3,-7),Vector2(31,-14),Vector2(51,-28),Vector2(46,-12),Vector2(24,1),Vector2(0,-4)])
    ]
    for k in range(2):
        draw_colored_polygon(tips[k],Color("#133447"))
        draw_polyline(PackedVector2Array([tips[k][1],tips[k][2],tips[k][3]]),Color("#2b9a9c"),1.5,true)
        var flip: float = -1.0 if k==0 else 1.0
        draw_line(Vector2(0,-5),Vector2(flip*38,-16),Color("#b1f0b8"),1.35,true)
    # Central jade sepal replaces the distracting bright bowl-shaped crescent.
    var sepal:=PackedVector2Array([Vector2(-13,-3),Vector2(-9,-13),Vector2(0,-23),Vector2(9,-13),Vector2(13,-3),Vector2(0,2)])
    draw_colored_polygon(sepal,Color("#16536a"))
    draw_polyline(PackedVector2Array([Vector2(-9,-13),Vector2(0,-23),Vector2(9,-13)]),Color("#6ad4b3"),1.4,true)
    draw_line(Vector2(0,-20),Vector2(0,0),Color("#b3f3d0"),1.15,true)
    draw_circle(Vector2(0,0),2.0,Color("#f0c88a"))
