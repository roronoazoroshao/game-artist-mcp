extends Node2D
# Trusted deterministic local Godot scene fixture for unscored AI art inspection.
# Screenshot is from an actual OpenGL framebuffer. This is NOT the target game.
var moonlight: bool = false

func _ready() -> void:
	moonlight = OS.get_cmdline_user_args().has("--moonlight")
	call_deferred("_capture")

func _draw() -> void:
	var dim: Vector2 = get_viewport_rect().size
	var top_color: Color = Color("#0e1630") if moonlight else Color("#344b57")
	var floor_color: Color = Color("#1c3945") if moonlight else Color("#516451")
	draw_rect(Rect2(Vector2.ZERO, dim), top_color, true)
	draw_rect(Rect2(0, dim.y * 0.72, dim.x, dim.y * 0.28), floor_color, true)
	draw_circle(Vector2(dim.x * 0.22, dim.y * 0.19), dim.x * 0.065, Color("#bcd9e8") if moonlight else Color("#ffd6a5"))
	# Frame of reference and foreground occluder to detect readability behind objects.
	draw_rect(Rect2(dim.x*0.12, dim.y*0.85, dim.x*0.76, dim.y*0.05), Color("#294349") if moonlight else Color("#6c5938"), true)
	draw_line(Vector2(dim.x*0.75,dim.y*.33),Vector2(dim.x*.91,dim.y*.22),Color("#486371"),maxf(1.0,dim.x*.02))
	draw_line(Vector2(dim.x*.80,dim.y*.31),Vector2(dim.x*.91,dim.y*.36),Color("#486371"),maxf(1.0,dim.x*.012))

func _capture() -> void:
	var art: Sprite2D = Sprite2D.new()
	var raw_art: Image = Image.load_from_file("res://art.png")
	if raw_art != null and not raw_art.is_empty():
		art.texture = ImageTexture.create_from_image(raw_art)
	if art.texture == null:
		push_error("GODOT_OBSERVE_REJECTED_NO_ART")
		get_tree().quit(1)
		return
	art.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var dim: Vector2 = get_viewport_rect().size
	art.position = Vector2(dim.x * .50, dim.y * .49)
	art.scale = Vector2.ONE * minf(dim.x*.54 / art.texture.get_width(), dim.y*.54 / art.texture.get_height())
	add_child(art)
	queue_redraw()
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var shot: Image = get_viewport().get_texture().get_image()
	if shot == null or shot.get_width() != int(dim.x) or shot.get_height() != int(dim.y):
		push_error("GODOT_OBSERVE_REJECTED_INVALID_FRAMEBUFFER")
		get_tree().quit(1)
		return
	if shot.save_png("res://scene-shot.png") != OK:
		push_error("GODOT_OBSERVE_REJECTED_SAVE_FAILED")
		get_tree().quit(1)
		return
	print("ARTIST_GODOT_SCENE_REAL_FRAMEBUFFER_OK")
	get_tree().quit(0)
