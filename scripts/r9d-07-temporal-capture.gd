extends Node2D

func fail_capture(why: String) -> void:
    push_error("R9D07_DENSE_CAPTURE_FAIL: " + why)
    get_tree().quit(1)

func _ready() -> void:
    call_deferred("capture")

func capture() -> void:
    var lantern: Node2D = get_node_or_null("SpiritLantern") as Node2D
    if lantern == null:
        fail_capture("missing SpiritLantern")
        return
    var player: AnimationPlayer = lantern.get_node_or_null("AnimationPlayer") as AnimationPlayer
    var foreground: Sprite2D = lantern.get_node_or_null("body/FrontCageRail") as Sprite2D
    if player == null or foreground == null or foreground.z_index != 6:
        fail_capture("missing canonical source and bronze depth")
        return
    if not player.has_animation("idle"):
        fail_capture("missing exact two-second idle")
        return
    var path: String = ProjectSettings.globalize_path("res://temporal")
    if DirAccess.make_dir_recursive_absolute(path) != OK:
        fail_capture("cannot create bounded screenshot output")
        return
    player.play("idle")
    # Framebuffer capture awaits rendering; freeze playback to keep seek times exact.
    player.pause()
    for tick: int in range(240):
        var current_time: float = float(tick) / 120.0
        player.seek(current_time, true)
        await RenderingServer.frame_post_draw
        var image: Image = get_viewport().get_texture().get_image()
        if image == null or image.get_width() != 512 or image.get_height() != 512:
            fail_capture("actual Godot 512px viewport absent")
            return
        var crop: Image = image.get_region(Rect2i(106, 75, 300, 300))
        var small: Image = crop.duplicate() as Image
        small.resize(64, 64, Image.INTERPOLATE_LANCZOS)
        if small.save_png("res://temporal/tick-%04d-64.png" % tick) != OK:
            fail_capture("cannot write real 120Hz source sample")
            return
        if tick % 2 == 0:
            var medium: Image = crop.duplicate() as Image
            medium.resize(128, 128, Image.INTERPOLATE_LANCZOS)
            if medium.save_png("res://temporal/tick-%04d-128.png" % tick) != OK:
                fail_capture("cannot write real 60Hz source sample")
                return
    print("R9D07_REAL_GODOT_DENSE_120HZ_SEEK_60HZ_SUBSET_CAPTURE_OK")
    get_tree().quit(0)
