extends Node2D
## Shader-generated, time-advected, editable flame contour. No external textures.
@export var dimensions: Vector2 = Vector2(134, 178)
@export var time_bias: float = 0.0
@export var hue_bias: float = 0.0
@export var heat: float = 1.0
var ink: ShaderMaterial

func _ready() -> void:
    ink = ShaderMaterial.new()
    ink.shader = preload("res://flame_field.gdshader")
    ink.set_shader_parameter("phase_bias", time_bias)
    ink.set_shader_parameter("hue_bias", hue_bias)
    ink.set_shader_parameter("heat", heat)
    material = ink

func _process(_delta: float) -> void:
    if get_parent().has_method("phase"):
        ink.set_shader_parameter("phase", get_parent().phase())
    queue_redraw()

func _draw() -> void:
    draw_rect(Rect2(-dimensions.x * 0.5, -dimensions.y, dimensions.x, dimensions.y), Color.WHITE)
