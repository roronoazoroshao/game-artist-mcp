extends PointLight2D
## Real Godot Light2D illuminating the actual altar; texture is authored in engine.
@export var jade_only:bool=false
var clock:float=0.0
func _ready() -> void:
    var dim:int=192
    var img:Image=Image.create(dim,dim,false,Image.FORMAT_RGBA8)
    for y in range(dim):
        for x in range(dim):
            var p:Vector2=(Vector2(float(x),float(y))-Vector2(float(dim-1)*0.5,float(dim-1)*0.5))/(float(dim)*0.5)
            var r:float=p.length()
            var a:float=pow(maxf(0.0,1.0-r),2.5)
            img.set_pixel(x,y,Color(a,a,a,a))
    texture=ImageTexture.create_from_image(img)
    texture_scale=2.0 if jade_only else 2.65
    color=Color("#9df7cf") if jade_only else Color("#65f1c9")
    energy=0.50 if jade_only else 0.77
    range_item_cull_mask=2 if jade_only else 1
    blend_mode=Light2D.BLEND_MODE_ADD
    shadow_enabled=false

func _process(delta:float) -> void:
    clock+=delta
    var t:float=get_parent().phase() if get_parent().has_method("phase") else clock
    # Luminous breath shares the 2.28rad/s harmonic with the flame core and ribbons.
    # Secondary ripple stays subtle; the stone should not flash like a strobe.
    var breath:float=sin(t*2.28)
    energy=(0.50+0.08*breath) if jade_only else (0.77+0.12*breath+0.028*sin(t*4.56-0.4))
