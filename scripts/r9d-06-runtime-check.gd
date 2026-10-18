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
    # R9d-07: verify actual runtime Sprite2D alpha keys are a narrowed
    # overlap rather than just a plausible JSON report.
    for time: float in [0.085, 0.095, 0.105]:
        player.seek(time, true)
        if abs(primary.modulate.a + secondary.modulate.a - 1.0) > 0.015:
            fail_gate("R9d-07 ghost fade did not keep complementary alpha")
            return
        if time == 0.085 and secondary.modulate.a > 0.03:
            fail_gate("early overlap ghost remains visible")
            return
        if time == 0.095 and secondary.modulate.a > 0.34:
            fail_gate("ghost overlap near early midpoint is still too wide")
            return
        if time == 0.105 and (secondary.modulate.a < 0.80 or secondary.modulate.a > 0.96):
            fail_gate("transition snaps rather than showing intermediate 120Hz fade")
            return
    # Compare authored SpiritLight key positions with the actual derived
    # animated CavityUnderlight modulate keys. No secondary PointLight2D.
    player.seek(0.0, true)
    var baseline_energy: float = light.energy
    var baseline_glow: float = underlight.modulate.a
    player.seek(0.18, true)
    var rising_energy: float = light.energy
    var rising_glow: float = underlight.modulate.a
    if not (rising_energy > baseline_energy + 0.07 and rising_glow > baseline_glow + 0.02):
        fail_gate("R9d-07 underlight does not rise with original SpiritLight")
        return
    player.seek(0.32, true)
    if not (light.energy < rising_energy and underlight.modulate.a < rising_glow):
        fail_gate("R9d-07 underlight does not fall with original SpiritLight")
        return
    player.seek(0.86, true)
    if underlight.modulate.a > 0.73 or underlight.modulate.a < rising_glow:
        fail_gate("R9d-07 glow did not cap and follow peak energy")
        return
    player.seek(1.999, true)
    if abs(underlight.modulate.a - baseline_glow) > 0.025:
        fail_gate("R9d-07 underlight flashes across the two-second loop")
        return
    print("R9D07_GODOT_GHOST_LIGHT_SYNC_TECHNICAL_OK")
    if lantern.get_node_or_null("Interaction/CollisionShape2D") == null:
        fail_gate("collision was removed")
        return
    print("R9D06_GODOT_LOOP_WRAP_TECHNICAL_OK")
    get_tree().quit(0)
