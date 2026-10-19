extends Node2D
## Hand-composed isometric courtyard detailing: no external bitmaps.
## Origin is altar center; this is decorative showcase art, not the fire asset.

const LINE:=Color("#547782")
const JADE:=Color("#56baa8")
const GOLD:=Color("#d6b079")
@export var reactive_jade:bool=true
var reflected_energy:float=0.0

func _process(_delta:float) -> void:
    var emitter:PointLight2D=get_node_or_null("../LinhHoa/JadeBounce") as PointLight2D
    var energy:float=emitter.energy if emitter!=null and emitter.visible and reactive_jade else 0.0
    if absf(energy-reflected_energy)>0.0001:
        reflected_energy=energy
        queue_redraw()

func _reflection_at(p:Vector2) -> float:
    # Localized reflectance of EXISTING inlay strokes, driven by live Light2D.
    # Basalt fracture geometry never gains the same specular amplification.
    var horizontal:float=p.x/170.0
    var vertical:float=p.y/85.0
    return reflected_energy*exp(-(horizontal*horizontal+vertical*vertical)*1.2)

func diamond(p:Vector2,w:float,h:float,color:Color) -> void:
    draw_colored_polygon(PackedVector2Array([
        p+Vector2(0,-h),p+Vector2(w,0),p+Vector2(0,h),p+Vector2(-w,0)
    ]),color)

func _draw() -> void:
    # Off-grid stone tessellation suggests a cracked ancient courtyard rather than a blank vector tile.
    for ix in range(-5,6):
        for iy in range(-5,6):
            var x:float=float(ix)
            var y:float=float(iy)
            var p:Vector2=Vector2((x-y)*42.0,(x+y)*21.0)
            if absf(p.x)/298.0 + absf(p.y)/149.0 > 0.86:
                continue
            var jitter:float=sin(x*19.0+y*31.0)*4.0
            var a:Vector2=p+Vector2(jitter,-5)
            var b:Vector2=p+Vector2(17.0+jitter,3.0)
            var c:Vector2=p+Vector2(20.0+jitter,4.5)
            var apha:float=0.05+0.07*absf(sin(x*10.0+y*7.0))
            draw_line(a,b,Color(0.34,0.56,0.59,apha),0.9,true)
            if int(ix+iy)%4==0:
                draw_line(b,c+Vector2(1.0,8.0),Color(0.35,0.55,0.51,apha*0.55),0.8,true)

    # Eight chipped paving inlays, deliberately staggered and perspective-correct.
    for i in range(8):
        var theta:float=TAU*(float(i)+0.13)/8.0
        var x:float=cos(theta)*244.0
        var y:float=sin(theta)*107.0
        var p:Vector2=Vector2(x,y)
        var reflectance:float=_reflection_at(p)
        diamond(p,11.0,5.0,Color(0.16+0.09*reflectance,0.30+0.29*reflectance,0.35+0.22*reflectance,0.63))
        draw_line(p+Vector2(-8,0),p+Vector2(0,-4),Color(0.32+0.17*reflectance,0.57+0.25*reflectance,0.58+0.22*reflectance,0.52),0.9,true)
        draw_line(p+Vector2(0,-4),p+Vector2(8,0),Color(0.25+0.18*reflectance,0.47+0.30*reflectance,0.48+0.26*reflectance,0.34),0.9,true)
        if i%3==0:
            draw_circle(p,1.8,Color(0.54+0.23*reflectance,0.79+0.16*reflectance,0.66+0.25*reflectance,0.65))

    # Stone splinters: restrained imperfections make the surface a place, not a diagram.
    for i in range(82):
        var a:float=float(i)
        var x:float=sin(a*37.18+0.3)*289.0
        var y:float=cos(a*51.91+1.1)*140.0
        if absf(x)/300.0 + absf(y)/150.0>0.94:
            continue
        var p:Vector2=Vector2(x,y)
        var extent:float=0.6+0.6*absf(sin(a*13.0))
        draw_line(p,p+Vector2(3.0*extent,1.5*extent),Color(0.44,0.62,0.59,0.12),0.75,true)
    # Faint relief of the spirit vein appears beneath the active flame.
    for i in range(3):
        var begin:Vector2=Vector2(-155.0+float(i)*8.0,-11.0+float(i)*7.0)
        var end:Vector2=Vector2(-112.0+float(i)*7.0,-19.0+float(i)*8.0)
        draw_line(begin,end,Color(0.45,0.78,0.68,0.11),0.7,true)
    for side in [-1.0,1.0]:
        # Broken stones around the guardian pylons.
        var anchor:Vector2=Vector2(side*203.0,18.0)
        diamond(anchor+Vector2(side*27.0,10.0),15.0,5.0,Color("#273c48"))
        diamond(anchor+Vector2(-side*21.0,22.0),11.0,4.0,Color("#1a303c"))
        draw_line(anchor+Vector2(side*17.0,10.0),anchor+Vector2(side*31.0,14.0),Color(0.35,0.55,0.52,0.4),0.8,true)
