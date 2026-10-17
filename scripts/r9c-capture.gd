extends Node2D

func _ready() -> void:
    call_deferred("capture_frames")

func capture_frames() -> void:
    var lantern: Node2D = get_node_or_null("SpiritLantern") as Node2D
    var player: AnimationPlayer = lantern.get_node_or_null("AnimationPlayer") as AnimationPlayer
    if player == null:
        push_error("GAME_ARTIST_R9C_CAPTURE_FAILED: missing player")
        get_tree().quit(1)
        return
    player.play("idle")
    player.seek(0.375, true)
    await RenderingServer.frame_post_draw
    var image: Image = get_viewport().get_texture().get_image()
    if image == null or image.get_width() != 512 or image.get_height() != 512:
        push_error("GAME_ARTIST_R9C_CAPTURE_FAILED: framebuffer dimensions")
        get_tree().quit(1)
        return
    var error_code: Error = image.save_png("res://r9c-runtime-frame-0375-TECHNICAL.png")
    if error_code != OK:
        push_error("GAME_ARTIST_R9C_CAPTURE_FAILED: PNG write")
        get_tree().quit(1)
        return
    print("GAME_ARTIST_R9C_REAL_FRAMEBUFFER_OK")
    get_tree().quit(0)
