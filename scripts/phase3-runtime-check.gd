extends Node2D

func fail_gate(message: String) -> void:
    push_error("GAME_ARTIST_PHASE3_FAIL: " + message)
    get_tree().quit(1)

func _ready() -> void:
    var lantern: Node2D = get_node_or_null("SpiritLantern") as Node2D
    if lantern == null:
        fail_gate("no lantern scene")
        return
    var names: Array[String] = [
        "body", "body/flame", "body/talisman_left",
        "body/talisman_right", "body/tassel"
    ]
    for entry: String in names:
        if lantern.get_node_or_null(NodePath(entry)) == null:
            fail_gate("missing part: " + entry)
            return
    var player: AnimationPlayer = lantern.get_node_or_null("AnimationPlayer") as AnimationPlayer
    var sprite: Sprite2D = lantern.get_node_or_null("body/flame/Sprite2D") as Sprite2D
    var light: PointLight2D = lantern.get_node_or_null("body/flame/SpiritLight") as PointLight2D
    if player == null or sprite == null or light == null:
        fail_gate("animation / flame / light missing")
        return
    if not player.has_animation("idle"):
        fail_gate("idle clip missing")
        return
    if lantern.get_node_or_null("Interaction/CollisionShape2D") == null:
        fail_gate("collision missing")
        return
    player.play("idle")
    player.seek(0.0, true)
    var first: AtlasTexture = sprite.texture as AtlasTexture
    if first == null:
        fail_gate("flame Sprite2D has no AtlasTexture")
        return
    var first_rect: Rect2 = first.region
    var first_pos: Vector2 = sprite.position
    var first_energy: float = light.energy
    player.seek(0.125, true)
    var second: AtlasTexture = sprite.texture as AtlasTexture
    if second == null or second.region == first_rect:
        fail_gate("authored flame frame did not advance")
        return
    var left_paper: Node2D = lantern.get_node_or_null("body/talisman_left") as Node2D
    var right_paper: Node2D = lantern.get_node_or_null("body/talisman_right") as Node2D
    if left_paper == null or right_paper == null:
        fail_gate("missing paper motion nodes")
        return
    # Authored IR smoothstep at t=0.125 over the first 0.5s segment:
    # smoothstep(0.25) = 0.15625. Godot must reproduce it after 30Hz baking.
    if abs(left_paper.rotation - (-0.025625)) > 0.002:
        fail_gate("Godot left paper motion deviates from authored smoothstep")
        return
    if abs(right_paper.rotation - 0.0340625) > 0.002:
        fail_gate("Godot right paper motion deviates from authored smoothstep")
        return
    player.seek(0.375, true)
    var fourth: AtlasTexture = sprite.texture as AtlasTexture
    if fourth == null or fourth.region == first_rect:
        fail_gate("fourth flame pose did not render")
        return
    player.seek(0.75, true)
    var later_energy: float = light.energy
    if abs(later_energy - first_energy) < 0.005:
        fail_gate("light energy did not animate")
        return
    if first_pos.length() > 400.0:
        fail_gate("invalid flame sprite offset")
        return
    if player.current_animation_length < 1.9:
        fail_gate("idle clip duration too short")
        return
    # R6 gameplay-scale behavior: verify real AnimationPlayer properties, not
    # only generated scene text or deterministic JavaScript preview curves.
    var body: Node2D = lantern.get_node_or_null("body") as Node2D
    var flame_part: Node2D = lantern.get_node_or_null("body/flame") as Node2D
    var tassel_part: Node2D = lantern.get_node_or_null("body/tassel") as Node2D
    if body == null or flame_part == null or tassel_part == null:
        fail_gate("R6 motion nodes missing")
        return
    player.seek(0.0, true)
    var body_rest_y: float = body.position.y
    var left_rest: Vector2 = left_paper.position
    var right_rest: Vector2 = right_paper.position
    player.seek(0.25, true)
    var flame_right_x: float = flame_part.position.x
    player.seek(0.5, true)
    if left_paper.position.distance_to(left_rest) < 0.2:
        fail_gate("R6 left paper lacks secondary position motion")
        return
    if right_paper.position.distance_to(right_rest) < 0.2:
        fail_gate("R6 right paper lacks secondary position motion")
        return
    player.seek(0.6, true)
    if abs(flame_part.position.x - flame_right_x) < 1.2:
        fail_gate("R6 flame lacks independent lateral drift")
        return
    player.seek(1.0, true)
    if body.position.y > body_rest_y - 0.7:
        fail_gate("R6 floating lantern body remains static")
        return
    if tassel_part.position.y < 104.5:
        fail_gate("R6 tassel lacks lagged settling motion")
        return
    player.seek(0.32, true)
    var low_energy: float = light.energy
    player.seek(0.86, true)
    if light.energy - low_energy < 0.12:
        fail_gate("R6 spirit light micro-beat not visible in Godot")
        return
    print("GAME_ARTIST_PHASE3_OK")
    get_tree().quit(0)
