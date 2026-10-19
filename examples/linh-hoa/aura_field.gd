extends Node2D
var shader_material: ShaderMaterial

func _ready() -> void:
    shader_material=ShaderMaterial.new()
    shader_material.shader=preload("res://aura_field.gdshader")
    material=shader_material

func _process(_delta:float) -> void:
    shader_material.set_shader_parameter("phase",get_parent().phase())
    queue_redraw()

func _draw() -> void:
    draw_rect(Rect2(-126,-210,252,222),Color.WHITE)
