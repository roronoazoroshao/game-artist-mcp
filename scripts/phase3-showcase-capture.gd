extends Node2D
## Playable R7 showcase controller. Real Godot framebuffer capture is opt-in.
## Normal editor/game execution never auto-quits; CI passes --capture-showcase.
var seconds: float = 0.0

func _ready() -> void:
    if OS.get_cmdline_user_args().has("--capture-showcase"):
        call_deferred("_capture_frames")

func _process(delta: float) -> void:
    seconds += delta
    var light: PointLight2D = get_node_or_null("Lantern/body/flame/SpiritLight") as PointLight2D
    var bounce: PointLight2D = get_node_or_null("GroundBounce") as PointLight2D
    if light != null and bounce != null:
        bounce.energy = clampf(light.energy * 0.48, 0.25, 0.62)

func _capture_frames() -> void:
    var player: AnimationPlayer = get_node_or_null("Lantern/AnimationPlayer") as AnimationPlayer
    var world: Node2D = get_node_or_null("Ground") as Node2D
    var front: Node2D = get_node_or_null("Foreground") as Node2D
    if player == null or world == null or front == null:
        push_error("R7 showcase scene missing animation or world geometry")
        get_tree().quit(1)
        return
    var dest: String = "res://r7-showcase-review"
    var make_error: Error = DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dest))
    if make_error != OK:
        push_error("R7 cannot create output directory: " + str(make_error))
        get_tree().quit(1)
        return
    var times: Array[float] = [0.0, 0.375, 0.875, 1.375]
    for index in range(times.size()):
        var moment: float = times[index]
        player.play("idle")
        player.seek(moment, true)
        world.set("elapsed", moment)
        front.set("elapsed", moment)
        world.queue_redraw()
        front.queue_redraw()
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var image: Image = get_viewport().get_texture().get_image()
        if image.is_empty() or image.get_width() != 512 or image.get_height() != 512:
            push_error("R7 Godot framebuffer missing or unexpected size")
            get_tree().quit(1)
            return
        var file_name: String = dest + "/frame-%02d.png" % index
        var save_error: Error = image.save_png(file_name)
        if save_error != OK:
            push_error("R7 framebuffer save failed: " + str(save_error))
            get_tree().quit(1)
            return
    print("GAME_ARTIST_R7_SHOWCASE_OK")
    get_tree().quit(0)
