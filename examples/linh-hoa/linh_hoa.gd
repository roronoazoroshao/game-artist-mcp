extends Node2D
## Thanh Liên U Hỏa: native procedural 2.5D spirit-flame VFX, version 2.
## All art editable as code, shader uniforms, and Godot scene child nodes.
@export_range(0.0,2.0,0.05) var intensity: float = 1.0
@export var time_override: float = -1.0
var elapsed: float = 0.0

func _process(delta: float) -> void:
    if time_override < 0.0:
        elapsed += delta
    queue_redraw()

func phase() -> float:
    return time_override if time_override >= 0.0 else elapsed

func _ellipse(center:Vector2,a:float,b:float,color:Color,filled:bool=false,thickness:float=1.0) -> void:
    var pts:=PackedVector2Array()
    for i in range(65):
        var ang:float=TAU*float(i)/64.0
        pts.append(center+Vector2(cos(ang)*a,sin(ang)*b))
    if filled: draw_colored_polygon(pts,color)
    else: draw_polyline(pts,color,thickness,true)

func _draw() -> void:
    var t:float=phase()
    var pulse:float=0.5+0.5*sin(t*2.75)
    # Ground contact, irradiated stone ring, embedded 2:1 ellipse perspective.
    _ellipse(Vector2(0,9),84,25,Color(0.025,0.08,0.13,0.57),true)
    for i in range(9,0,-1):
        _ellipse(Vector2(0,8),float(i)*8.5,float(i)*2.6,Color(0.02,0.55,0.51,0.008*intensity),true)
    _ellipse(Vector2(0,7),61,17,Color(0.05,0.16,0.21,0.55),true)
    _ellipse(Vector2(0,7),66,18,Color(0.26,0.71,0.65,0.23+0.10*pulse),false,1.25)
    _ellipse(Vector2(0,7),48,12.5,Color(0.90,0.73,0.43,0.24+0.13*pulse),false,1.0)
    # Fine embedded calligraphy-inspired radial strokes avoid a literal concentric UFO disk.
    for i in range(12):
        var ang:float=TAU*float(i)/12.0+0.035
        var inner:Vector2=Vector2(cos(ang)*48.5,7.0+sin(ang)*12.7)
        var outer:Vector2=Vector2(cos(ang)*63.5,7.0+sin(ang)*17.5)
        draw_line(inner,outer,Color(0.65,0.84,0.70,0.34+0.13*pulse),1.0,true)
        if i%3==0:
            draw_circle(outer,1.25,Color(1.0,0.80,0.51,0.85))
    for j in range(4):
        var radius:float=29.0+float(j)*9.5
        var ang:float=-t*0.11+float(j)*1.57
        var p0:Vector2=Vector2(cos(ang)*radius,7.0+sin(ang)*radius*0.25)
        var p1:Vector2=Vector2(cos(ang+0.17)*radius,7.0+sin(ang+0.17)*radius*0.25)
        draw_line(p0,p1,Color(0.36,0.97,0.82,0.20+0.25*pulse),1.5,true)
    # A handful of crisp, detached embers cross foreground; no stochastic per-frame popping.
    for i in range(19):
        var seed:float=float(i)*1.6180339
        var age:float=fposmod(t*(23.0+float(i%5)*3.0)+seed*27.0,183.0)
        var x:float=sin(seed*4.9+t*0.63)*(18.0+float(i%5)*8.0)+sin(age*0.07+seed)*6.0
        var y:float=-25.0-age
        var alpha:float=sin(PI*age/183.0)
        if alpha>0.13:
            var bright:Color=Color(0.75,0.96,0.69,alpha*0.7) if i%3!=0 else Color(1.0,0.80,0.52,alpha*0.85)
            draw_line(Vector2(x-0.8,y+5),Vector2(x,y),Color(0.13,0.88,0.76,alpha*0.44),1.05,true)
            draw_circle(Vector2(x,y),1.05 if i%3!=0 else 1.5,bright)
