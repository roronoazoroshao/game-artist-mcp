extends Node2D
## Native procedural distant spirit-vein landscape, decorative showcase only.
var ink:ShaderMaterial
func _ready() -> void:
    ink=ShaderMaterial.new()
    ink.shader=preload("res://backdrop.gdshader")
    material=ink
func _process(delta:float) -> void:
    if ink!=null:
        ink.set_shader_parameter("phase",get_parent().seconds)
func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO,Vector2(960,540)),Color.WHITE)
