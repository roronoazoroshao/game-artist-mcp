extends Node2D
## Self-contained Godot application + reproducible framebuffer QA.
const FIRE_SCENE: PackedScene = preload("res://linh_hoa.tscn")
const THUMB_STAGE: Script = preload("res://thumbnail_stage.gd")
@onready var fire: Node2D = $LinhHoa
var seconds: float = 0.0
@export var reactive_stone:bool=true

func _ready() -> void:
    # Basalt receives the main Light2D (mask 1); jade inlays receive a
    # localized native jade bounce light (mask 2). No ineffective shader overlay.
    if OS.get_cmdline_user_args().has("--capture-material-ab"):
        call_deferred("_capture_material_ab")
    elif OS.get_cmdline_user_args().has("--capture-light-ab"):
        call_deferred("_capture_light_ab")
    elif OS.get_cmdline_user_args().has("--capture-motion"):
        call_deferred("_capture_motion")
    elif OS.get_cmdline_user_args().has("--capture-native"):
        call_deferred("_capture_native")

func _process(delta: float) -> void:
    seconds += delta
    queue_redraw()

func _draw() -> void:
    var sz: Vector2 = get_viewport_rect().size
    # Backdrop child shader paints the full viewport beneath this geometry.
    # Hand-authored isometric garden: 2:1 diamond floor plane and slate steps.
    var c: Vector2 = Vector2(sz.x * 0.5, sz.y * 0.68)
    var width: float = minf(sz.x * 0.34, 310.0)
    var height: float = width * 0.5
    var p := PackedVector2Array([c + Vector2(0,-height),c + Vector2(width,0),c + Vector2(0,height),c + Vector2(-width,0)])
    draw_colored_polygon(p, Color("#1c2c3c"))
    for j in range(-4,5):
        var offset: float = float(j) * 46.0
        draw_line(c + Vector2(offset,-height + absf(offset) * 0.5), c + Vector2(offset,height - absf(offset) * 0.5), Color(0.35,0.50,0.58,0.13), 1.0)
    var border := PackedVector2Array([p[0],p[1],p[2],p[3],p[0]])
    draw_polyline(border, Color("#50717a"), 2.0, true)
    # A low hexagonal basalt shrine physically receives the flame shadow and runes.
    var altar: Vector2 = c + Vector2(0, 12)
    var crown := PackedVector2Array([altar + Vector2(0,-42),altar + Vector2(110,-5),altar + Vector2(110,10),altar + Vector2(0,48),altar + Vector2(-110,10),altar + Vector2(-110,-5)])
    var front := PackedVector2Array([altar + Vector2(-110,10),altar + Vector2(0,48),altar + Vector2(110,10),altar + Vector2(110,30),altar + Vector2(0,68),altar + Vector2(-110,30)])
    var lamp:PointLight2D=fire.get_node_or_null("SpiritLight") as PointLight2D
    var bounce:float=clampf(lamp.energy,0.0,1.1) if lamp!=null and lamp.visible and reactive_stone else 0.0
    # Existing basalt topology only: matte side wall, illuminated top surface.
    # Vertex-colored fan models light falloff over stone, driven by true Light2D energy.
    draw_colored_polygon(front,Color(0.083+0.004*bounce,0.137+0.010*bounce,0.196+0.012*bounce))
    var center:Vector2=altar+Vector2(0,4)
    var face_mid:Color=Color(0.190+0.018*bounce,0.267+0.070*bounce,0.314+0.064*bounce)
    var face_edge:Color=Color(0.190+0.003*bounce,0.267+0.012*bounce,0.314+0.011*bounce)
    for k in range(crown.size()):
        var next:int=(k+1)%crown.size()
        draw_polygon(PackedVector2Array([center,crown[k],crown[next]]),
            PackedColorArray([face_mid,face_edge,face_edge]))
    draw_polyline(PackedVector2Array([crown[0],crown[1],crown[2],crown[3],crown[4],crown[5],crown[0]]), Color(0.37+0.05*bounce,0.53+0.07*bounce,0.53+0.06*bounce), 1.8, true)
    for j in [-1, 1]:
        var x: float = float(j) * 216.0
        var foot: Vector2 = c + Vector2(x,-10)
        var side := PackedVector2Array([foot+Vector2(-18,-77),foot+Vector2(0,-88),foot+Vector2(0,-8),foot+Vector2(-18,2)])
        var face := PackedVector2Array([foot+Vector2(0,-88),foot+Vector2(18,-77),foot+Vector2(18,2),foot+Vector2(0,-8)])
        draw_colored_polygon(side, Color("#263c4a"))
        draw_colored_polygon(face, Color("#152835"))
        draw_line(foot+Vector2(0,-75), foot+Vector2(0,-27), Color("#5cafa5"), 1.5, true)
        draw_circle(foot+Vector2(0,-68), 3.0, Color("#b2d7ac"))
    # Four diagonally opposed cyan inlay stones anchor the magic effect in world space.
    for axis in [Vector2(-188,4),Vector2(188,4),Vector2(0,-93),Vector2(0,93)]:
        var q: Vector2 = c + axis
        var glyph := PackedVector2Array([q+Vector2(0,-8),q+Vector2(17,0),q+Vector2(0,8),q+Vector2(-17,0),q+Vector2(0,-8)])
        draw_polyline(glyph, Color("#5b9299"), 1.2, true)
        draw_circle(q, 1.7, Color("#d0b67c"))
    # Foreground edge/shadow visible below flame; no opaque billboard.
    draw_line(Vector2(0,sz.y-21),Vector2(sz.x,sz.y-21),Color(0.12,0.20,0.26,0.55),2.0)

func _capture_material_ab() -> void:
    # Actual light-mask ablation: basalt response (mask 1) vs localized
    # jade bounce (mask 2), both in Godot's Light2D composition pass.
    var relief:Node2D=get_node_or_null("RitualGround") as Node2D
    var light:PointLight2D=fire.get_node_or_null("SpiritLight") as PointLight2D
    var bounce:PointLight2D=fire.get_node_or_null("JadeBounce") as PointLight2D
    if relief==null or light==null or bounce==null:
        push_error("Material probe requires native Light2D channels")
        get_tree().quit(1)
        return
    var original_reactive:bool=bool(relief.get("reactive_jade"))
    var original_stone:bool=reactive_stone
    fire.set("time_override",0.78)
    set_process(false)
    var out:String="res://captures"
    var err:Error=DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out))
    if err!=OK:
        get_tree().quit(1)
        return
    for with_material in [true,false]:
        relief.set("reactive_jade",with_material)
        reactive_stone=with_material
        for with_light in [true,false]:
            light.visible=with_light
            bounce.visible=with_material and with_light
            fire.queue_redraw()
            relief.queue_redraw()
            queue_redraw()
            await get_tree().process_frame
            await RenderingServer.frame_post_draw
            var frame:Image=get_viewport().get_texture().get_image()
            if frame.is_empty() or frame.get_size()!=Vector2i(960,540):
                push_error("Material probe invalid framebuffer")
                get_tree().quit(1)
                return
            var name:String=("material" if with_material else "default")+"-"+("lit" if with_light else "dark")
            err=frame.save_png(out+"/"+name+".png")
            if err!=OK:
                get_tree().quit(1)
                return
    light.visible=true
    bounce.visible=true
    relief.set("reactive_jade",original_reactive)
    reactive_stone=original_stone
    print("LINH_HOA_MATERIAL_2X2_REAL_FRAMEBUFFER_OK")
    get_tree().quit(0)

func _capture_light_ab() -> void:
    # Same authored phase for both frames; only actual Godot PointLight2D visibility changes.
    var light:PointLight2D=fire.get_node_or_null("SpiritLight") as PointLight2D
    var bounce:PointLight2D=fire.get_node_or_null("JadeBounce") as PointLight2D
    if light==null or bounce==null:
        push_error("Missing true Godot PointLight2D")
        get_tree().quit(1)
        return
    fire.set("time_override",0.78)
    # Pin backdrop clock as well, so ON/OFF difference cannot be ambient fog motion.
    set_process(false)
    var target:String="res://captures"
    var err:Error=DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(target))
    if err!=OK:
        get_tree().quit(1)
        return
    for index in range(2):
        light.visible=index==0
        bounce.visible=index==0
        fire.queue_redraw()
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var im:Image=get_viewport().get_texture().get_image()
        if im.is_empty() or im.get_size()!=Vector2i(960,540):
            get_tree().quit(1)
            return
        err=im.save_png(target + ("/light-on.png" if index==0 else "/light-off.png"))
        if err!=OK:
            get_tree().quit(1)
            return
    light.visible=true
    bounce.visible=true
    print("LINH_HOA_LIGHT_AB_NATIVE_FRAMEBUFFER_OK")
    get_tree().quit(0)

func _capture_motion() -> void:
    # Uniform 24-frame temporal capture, authored shader phase pinned to real Godot framebuffer.
    var out:String="res://captures/motion-temp"
    var err:Error=DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out))
    if err!=OK:
        push_error("Motion frame directory inaccessible")
        get_tree().quit(1)
        return
    for index in range(24):
        var timestamp:float=float(index)/18.0
        fire.set("time_override",timestamp)
        fire.queue_redraw()
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var framebuffer:Image=get_viewport().get_texture().get_image()
        if framebuffer.is_empty() or framebuffer.get_size()!=Vector2i(960,540):
            push_error("Motion Godot framebuffer invalid")
            get_tree().quit(1)
            return
        err=framebuffer.save_png(out + "/motion-%02d.png" % index)
        if err!=OK:
            push_error("Motion Godot framebuffer save failed")
            get_tree().quit(1)
            return
    print("LINH_HOA_MOTION_24_NATIVE_FRAMES_OK")
    get_tree().quit(0)

func _capture_native() -> void:
    var dir: String = "res://captures"
    var err: Error = DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
    if err != OK:
        push_error("Cannot create Godot capture directory")
        get_tree().quit(1)
        return
    for i in range(4):
        fire.set("time_override", [0.0,0.34,0.78,1.21][i])
        fire.queue_redraw()
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var frame: Image = get_viewport().get_texture().get_image()
        if frame.is_empty() or frame.get_width() != 960 or frame.get_height() != 540:
            push_error("Invalid scene framebuffer (960x540 expected)")
            get_tree().quit(1)
            return
        err = frame.save_png(dir + "/game-%02d.png" % i)
        if err != OK:
            push_error("Save game framebuffer failed")
            get_tree().quit(1)
            return
    for edge in [64, 128]:
        var thumb_view := SubViewport.new()
        thumb_view.size = Vector2i(edge, edge)
        thumb_view.disable_3d = true
        thumb_view.transparent_bg = false
        thumb_view.render_target_update_mode = SubViewport.UPDATE_ALWAYS
        add_child(thumb_view)
        var stage := Node2D.new()
        stage.set_script(THUMB_STAGE)
        stage.set("edge", edge)
        thumb_view.add_child(stage)
        var f: Node2D = FIRE_SCENE.instantiate()
        stage.add_child(f)
        f.position = Vector2(float(edge) * 0.5, float(edge) * 0.80)
        f.scale = Vector2.ONE * (float(edge) / 256.0) * 1.05
        f.set("time_override", 0.78)
        stage.queue_redraw()
        f.queue_redraw()
        await get_tree().process_frame
        await get_tree().process_frame
        await RenderingServer.frame_post_draw
        var shot: Image = thumb_view.get_texture().get_image()
        if shot.is_empty() or shot.get_width() != edge or shot.get_height() != edge:
            push_error("Invalid native thumbnail framebuffer: " + str(edge))
            get_tree().quit(1)
            return
        err = shot.save_png(dir + "/native-%d.png" % edge)
        if err != OK:
            push_error("Failed saving native thumbnail")
            get_tree().quit(1)
            return
        thumb_view.queue_free()
    print("LINH_HOA_GODOT_FRAMEBUFFER_OK: 4 game frames and native 64px/128px")
    get_tree().quit(0)
