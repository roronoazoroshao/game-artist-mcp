extends PointLight2D
## Real Godot Light2D illuminating the actual altar; texture is authored in engine.
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
    texture_scale=3.35
    color=Color("#58f7cd")
    energy=0.80
    blend_mode=Light2D.BLEND_MODE_ADD
    shadow_enabled=false

func _process(delta:float) -> void:
    clock+=delta
    var t:float=get_parent().phase() if get_parent().has_method("phase") else clock
    energy=0.80+0.17*sin(t*3.0)+0.065*sin(t*8.7)
