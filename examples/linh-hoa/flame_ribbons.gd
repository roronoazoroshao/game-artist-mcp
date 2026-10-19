extends Node2D
## V4: continuous, root-pinned ribbons, driven by the same shared bend as flame_field.gdshader.
## Draw complete, vertex-colored mesh strips rather than independently animated quad segments.
const DEEP:Color=Color("#073047")
const TURQUOISE:Color=Color("#1acebe")
const SAPPHIRE:Color=Color("#0c6b98")
const AMBER:Color=Color("#ffdd91")

func _process(_delta:float) -> void:
    queue_redraw()

func _t() -> float:
    return get_parent().phase() if get_parent().has_method("phase") else 0.0

func _bezier(a:Vector2,b:Vector2,c:Vector2,d:Vector2,u:float) -> Vector2:
    var v:float=1.0-u
    return a*v*v*v+3.0*b*v*v*u+3.0*c*v*u*u+d*u*u*u

func _path(knots:Array[Vector2],u:float,t:float,seed:float) -> Vector2:
    var point:Vector2=_bezier(knots[0],knots[1],knots[2],knots[3],u)
    var h:float=clampf(-point.y/186.0,0.0,1.0)
    # Identical shared 3.6*h / 1.65*t base phase to the shader silhouette.
    # sin(h*k-t*w)-sin(-t*w) guarantees zero displacement at the root.
    var shared_bend:float=6.0*pow(h,0.84)*(sin(h*3.6-t*1.65)-sin(-t*1.65))
    var delayed_curl:float=2.8*pow(h,1.65)*sin(h*8.7-t*(1.93+seed*0.11)+seed)
    point.x+=shared_bend+delayed_curl
    return point

func _strip(knots:Array[Vector2],base_width:float,root_color:Color,tip_color:Color,t:float,seed:float) -> void:
    var samples:int=48
    var left:=PackedVector2Array()
    var right:=PackedVector2Array()
    var left_colors:=PackedColorArray()
    var right_colors:=PackedColorArray()
    var inner_left:=PackedVector2Array()
    var inner_right:=PackedVector2Array()
    var inner_colors:=PackedColorArray()
    var core_color:Color=Color(0.71,1.0,0.84,0.0)
    for i in range(samples+1):
        var u:float=float(i)/float(samples)
        var center:Vector2=_path(knots,u,t,seed)
        var before:Vector2=_path(knots,maxf(0.0,u-0.012),t,seed)
        var after:Vector2=_path(knots,minf(1.0,u+0.012),t,seed)
        var tangent:Vector2=after-before
        if tangent.length_squared()<0.0001:
            tangent=Vector2(0,-1)
        var normal:Vector2=Vector2(-tangent.y,tangent.x).normalized()
        var breath:float=1.0+0.043*sin(t*2.28-u*2.9)
        var envelope:float=(0.27+0.75*sin(PI*u))*pow(1.0-u,0.78)*breath
        var width:float=base_width*envelope
        var paint:Color=root_color.lerp(tip_color,u)
        paint.a*=smoothstep(0.0,0.12,u)*(1.0-smoothstep(0.84,1.0,u))
        left.append(center+normal*width)
        right.append(center-normal*width)
        left_colors.append(paint)
        right_colors.append(paint)
        var line:Color=core_color
        line.a=paint.a*0.20
        inner_left.append(center+normal*width*0.16)
        inner_right.append(center-normal*width*0.16)
        inner_colors.append(line)
    var verts:=PackedVector2Array()
    var colors:=PackedColorArray()
    for i in range(samples+1):
        verts.append(left[i])
        colors.append(left_colors[i])
    for i in range(samples,-1,-1):
        verts.append(right[i])
        colors.append(right_colors[i])
    draw_polygon(verts,colors)
    # One continuous narrow flowing highlight, never a separate mirrored ribbon.
    verts=PackedVector2Array()
    colors=PackedColorArray()
    for i in range(samples+1):
        verts.append(inner_left[i])
        colors.append(inner_colors[i])
    for i in range(samples,-1,-1):
        verts.append(inner_right[i])
        colors.append(inner_colors[i])
    draw_polygon(verts,colors)

func _draw() -> void:
    var t:float=_t()
    # Fixed anchors converge at the flame foot; only the upper portions advect.
    var left:Array[Vector2]=[Vector2(-21,-17),Vector2(-54,-41),Vector2(-62,-95),Vector2(-33,-131)]
    _strip(left,8.0,SAPPHIRE,Color(0.07,0.66,0.65,0.09),t,0.2)
    var left_inner:Array[Vector2]=[Vector2(-18,-13),Vector2(-34,-61),Vector2(-16,-100),Vector2(-23,-145)]
    _strip(left_inner,6.8,TURQUOISE,Color(0.54,1.0,0.82,0.10),t,1.1)
    var center:Array[Vector2]=[Vector2(-5,-14),Vector2(-23,-51),Vector2(-13,-104),Vector2(3,-163)]
    _strip(center,4.1,AMBER,Color(0.92,1.0,0.74,0.11),t,2.2)
    var right:Array[Vector2]=[Vector2(22,-20),Vector2(54,-57),Vector2(19,-85),Vector2(39,-129)]
    _strip(right,7.9,Color(0.0,0.42,0.58,0.82),Color(0.11,0.93,0.79,0.08),t,1.6)
