extends Node2D

func fail_capture(reason: String) -> void:
    push_error("R9D_MOTION_CAPTURE_FAIL: " + reason)
    get_tree().quit(1)

func _ready() -> void:
    call_deferred("capture_motion")

func capture_motion() -> void:
    var lantern: Node2D = get_node_or_null("SpiritLantern") as Node2D
    if lantern == null:
        fail_capture("SpiritLantern missing")
        return
    var player: AnimationPlayer = lantern.get_node_or_null("AnimationPlayer") as AnimationPlayer
    var flame: Sprite2D = lantern.get_node_or_null("body/flame/Sprite2D") as Sprite2D
    var foreground: Sprite2D = lantern.get_node_or_null("body/FrontCageRail") as Sprite2D
    if player == null or flame == null or foreground == null:
        fail_capture("no AnimationPlayer/flame/front cage depth layer")
        return
    if foreground.z_index <= flame.get_parent().z_index:
        fail_capture("front bronze occlusion depth lower than flame")
        return
    player.play("idle")
    # Framebuffer capture awaits rendering; freeze playback to keep seek times exact.
    player.pause()
    # Preserve six legacy captures; add precise 2s loop/crossfade probe times.
    var times: Array[float] = [0.0, 0.001, 0.069, 0.070, 0.095, 0.105, 0.124, 0.125, 0.180, 0.375, 0.75, 1.25, 1.875, 1.945, 1.999]
    for time: float in times:
        player.seek(time, true)
        await RenderingServer.frame_post_draw
        var source: Image = get_viewport().get_texture().get_image()
        if source == null or source.get_width() != 512 or source.get_height() != 512:
            fail_capture("real framebuffer missing or unexpected dimensions")
            return
        for dimension: int in [512, 128, 64]:
            var screenshot: Image = source.duplicate() as Image
            if dimension != 512:
                # Item readability, not 512px scene readability: keep the same
                # authored 300x300 gameplay region for 128px/64px sprite crops.
                # This includes handle, roof, charms, base and fringe across
                # all four poses; the 512px capture retains scene context.
                screenshot = source.get_region(Rect2i(106, 75, 300, 300))
                screenshot.resize(dimension, dimension, Image.INTERPOLATE_LANCZOS)
            var filename: String = "res://r9d-t-%04d-%d.png" % [int(round(time * 1000.0)), dimension]
            if screenshot.save_png(filename) != OK:
                fail_capture("cannot write real Godot image " + filename)
                return
        print("R9D_REAL_FRAME_TIME " + str(time))
    print("R9D_REAL_GODOT_SIX_TIME_THREE_SCALE_CAPTURE_OK")
    print("R9D06_REAL_GODOT_FIFTEEN_TIME_THREE_SCALE_CAPTURE_OK")
    get_tree().quit(0)
