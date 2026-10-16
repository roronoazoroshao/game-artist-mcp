extends Node2D

func fail_gate(message: String) -> void:
    push_error("GAME_ARTIST_R9C_FAIL: " + message)
    get_tree().quit(1)

func _ready() -> void:
    var lantern: Node2D = get_node_or_null("SpiritLantern") as Node2D
    if lantern == null:
        fail_gate("missing SpiritLantern")
        return
    var player: AnimationPlayer = lantern.get_node_or_null("AnimationPlayer") as AnimationPlayer
    var flame: Sprite2D = lantern.get_node_or_null("body/flame/Sprite2D") as Sprite2D
    var light: PointLight2D = lantern.get_node_or_null("body/flame/SpiritLight") as PointLight2D
    if player == null or flame == null or light == null:
        fail_gate("missing player, raster flame or light")
        return
    if not player.has_animation("idle"):
        fail_gate("missing idle")
        return
    player.play("idle")
    if abs(player.current_animation_length - 2.0) > 0.001:
        fail_gate("loop is not 2 seconds")
        return
    var poses: Array[Rect2] = []
    for t: float in [0.0, 0.125, 0.25, 0.375]:
        player.seek(t, true)
        var frame: AtlasTexture = flame.texture as AtlasTexture
        if frame == null or frame.atlas == null:
            fail_gate("flame texture is not an atlas")
            return
        if frame.region in poses:
            fail_gate("four animated flame frames not distinct")
            return
        poses.append(frame.region)
    player.seek(0.0, true)
    var first_energy: float = light.energy
    player.seek(0.75, true)
    if abs(light.energy-first_energy) < 0.03:
        fail_gate("light animation inactive")
        return
    var left: Node2D = lantern.get_node_or_null("body/talisman_left") as Node2D
    var right: Node2D = lantern.get_node_or_null("body/talisman_right") as Node2D
    var tassel: Node2D = lantern.get_node_or_null("body/tassel") as Node2D
    if left == null or right == null or tassel == null:
        fail_gate("missing child cutout parts")
        return
    if abs(left.rotation) < 0.001 or abs(right.rotation) < 0.001:
        fail_gate("rig rotation missing")
        return
    if lantern.get_node_or_null("Interaction/CollisionShape2D") == null:
        fail_gate("collision missing")
        return
    print("GAME_ARTIST_R9C_GODOT_RUNTIME_OK")
    get_tree().quit(0)
