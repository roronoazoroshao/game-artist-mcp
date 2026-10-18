extends Node2D

func fail_gate(reason: String) -> void:
    push_error("R9D06_GODOT_RUNTIME_REJECTED: " + reason)
    get_tree().quit(1)

func _ready() -> void:
    call_deferred("verify_animation")

func verify_animation() -> void:
    var lantern: Node2D = get_node_or_null("SpiritLantern") as Node2D
    if lantern == null:
        fail_gate("missing lantern")
        return
    var player: AnimationPlayer = lantern.get_node_or_null("AnimationPlayer") as AnimationPlayer
    var primary: Sprite2D = lantern.get_node_or_null("body/flame/Sprite2D") as Sprite2D
    var secondary: Sprite2D = lantern.get_node_or_null("body/flame/SpriteBlend2D") as Sprite2D
    var underlight: Sprite2D = lantern.get_node_or_null("body/CavityUnderlight") as Sprite2D
    var rail: Sprite2D = lantern.get_node_or_null("body/FrontCageRail") as Sprite2D
    var light: PointLight2D = lantern.get_node_or_null("body/flame/SpiritLight") as PointLight2D
    if player == null or primary == null or secondary == null or underlight == null or rail == null or light == null:
        fail_gate("hybrid scene nodes missing")
        return
    if rail.z_index != 6 or underlight.z_index >= 4 or primary.get_parent().z_index != 4:
        fail_gate("front-bronze depth order violated")
        return
    if not player.has_animation("idle"):
        fail_gate("missing idle animation")
        return
    player.play("idle")
    if abs(player.current_animation_length - 2.0) > 0.001:
        fail_gate("animation duration changed")
        return
    var visible_regions: Array[Rect2] = []
    for time: float in [0.0, 0.125, 0.25, 0.375]:
        player.seek(time, true)
        if abs(primary.modulate.a + secondary.modulate.a - 1.0) > 0.015:
            fail_gate("flame alpha not complementary at sampled pose")
            return
        var active: Sprite2D = primary if primary.modulate.a > secondary.modulate.a else secondary
        var tex: AtlasTexture = active.texture as AtlasTexture
        if tex == null or tex.atlas == null or tex.region in visible_regions:
            fail_gate("real four flame poses did not animate distinctly")
            return
        visible_regions.append(tex.region)
    for time: float in [0.07, 0.095, 0.195, 1.945, 1.999]:
        player.seek(time, true)
        if abs(primary.modulate.a + secondary.modulate.a - 1.0) > 0.015:
            fail_gate("alpha sum changed during crossfade")
            return
        if primary.modulate.a < -0.01 or secondary.modulate.a < -0.01:
            fail_gate("invalid negative opacity")
            return
    player.seek(0.0, true)
    var first_texture: AtlasTexture = primary.texture as AtlasTexture
    var first_energy: float = light.energy
    player.seek(1.999, true)
    var final_texture: AtlasTexture = primary.texture as AtlasTexture
    if first_texture == null or final_texture == null or first_texture.region != final_texture.region:
        fail_gate("C-to-A wrap prepared wrong first texture")
        return
    if primary.modulate.a < 0.97:
        fail_gate("C-to-A loop did not finish fade")
        return
    player.seek(0.75, true)
    if abs(light.energy - first_energy) < 0.03:
        fail_gate("original light animation was disabled")
        return
    player.seek(0.0, true)
    player.play("idle")
    player.advance(1.945)
    var advanced_alpha: float = primary.modulate.a
    player.seek(1.945, true)
    if abs(primary.modulate.a - advanced_alpha) > 0.06:
        fail_gate("playback and seek disagree at loop seam")
        return
    if lantern.get_node_or_null("Interaction/CollisionShape2D") == null:
        fail_gate("collision was removed")
        return
    print("R9D06_GODOT_LOOP_WRAP_TECHNICAL_OK")
    get_tree().quit(0)
