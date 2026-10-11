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
    print("GAME_ARTIST_PHASE3_OK")
    get_tree().quit(0)
