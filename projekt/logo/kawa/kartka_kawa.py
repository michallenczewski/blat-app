exec(open('kawa.py').read().split("\nV={}")[0])
import math
def sheetp(w,h,lines=0):
    s=ext(f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="3"/>',(2,4),4.5,W)
    for i in range(lines): s+=f'<path d="M{-w/2+10} {-h/2+14+i*11} H{w/2-10-(14 if i==lines-1 else 0)}" stroke="{K}" stroke-width="4.5" stroke-linecap="round"/>'
    return s
stain=lambda r: f'<circle r="{r}" fill="none" stroke="{K}" stroke-width="3" stroke-dasharray="{2*math.pi*r*0.8:.1f} {2*math.pi*r*0.2:.1f}" transform="rotate(30)"/>'
V={}
V['t1']=center(at(72,74,sheetp(62,80),-8)+at(100,104,saucer(22,(2,4))+cup(12,-30,(2,3),10,8)))
V['t2']=center(at(72,72,sheetp(62,80,3),-8)+at(104,104,cup(18,-35,(2,4,6),13,11)))
V['t3']=center(at(80,78,sheetp(66,84),-6)+at(80,78,cup(20,-30,(2,4,6),13,11)))
V['t4']=center(at(74,74,sheetp(64,82),-8)+at(68,60,stain(13))+at(100,106,cup(17,-35,(2,4,6),12,10)))
# --- izometria: x w prawo-dół, y w lewo-dół, z w górę ---
c30,s30=math.cos(math.pi/6),math.sin(math.pi/6)
def P(x,y,z=0,ox=80,oy=80): return (ox+(x-y)*c30, oy+(x+y)*s30-z)
def poly(pts): return '<path d="M'+' L'.join(f'{a:.2f} {b:.2f}' for a,b in pts)+' Z"/>'
def plate(x0,y0,w,d,z,th,fill=L,steps=None):
    pts=[P(x0,y0,z),P(x0+w,y0,z),P(x0+w,y0+d,z),P(x0,y0+d,z)]
    st=steps or tuple(range(2,th+1,2))
    return ext(poly(pts),st,4.5,fill)
def mug(x,y,z,r,h):
    cx,cy=P(x,y,z); rx,ry=r*1.2247,r*0.7071
    e=lambda yy,f,extra='': f'<ellipse cx="{cx:.2f}" cy="{yy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" {extra}/>'
    side=f'<path d="M{cx-rx:.2f} {cy-h:.2f} V{cy:.2f} A{rx:.2f} {ry:.2f} 0 0 0 {cx+rx:.2f} {cy:.2f} V{cy-h:.2f} Z" fill="{K}" stroke="{K}" stroke-width="4.5" stroke-linejoin="round"/>'
    handle=f'<path d="M{cx+rx-1:.2f} {cy-h*0.75:.2f} c{r*0.75:.2f} -2 {r*0.75:.2f} {h*0.55:.2f} 0 {h*0.55:.2f}" fill="none" stroke="{K}" stroke-width="5.5" stroke-linecap="round"/>'
    top=f'<ellipse cx="{cx:.2f}" cy="{cy-h:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{W}" stroke="{K}" stroke-width="4.5"/>'
    coffee=f'<ellipse cx="{cx:.2f}" cy="{cy-h:.2f}" rx="{rx-7:.2f}" ry="{ry-4.2:.2f}" fill="{K}"/>'
    return handle+side+top+coffee
V['i1']=center(plate(-34,-30,64,72,0,4,W)+mug(8,14,4,17,22))
V['i2']=center(plate(-40,-40,80,80,0,12)+plate(-30,-26,40,50,12,3,W)+mug(18,18,12,13,16))
V['i3']=center(plate(-40,-40,80,80,0,12)+mug(0,0,12,18,22))
V['i4']=center(plate(-30,-36,56,70,0,4,W)+''.join(f'<path d="M{P(-22,-28+i*10,4)[0]:.1f} {P(-22,-28+i*10,4)[1]:.1f} L{P(14-(10 if i==2 else 0),-28+i*10,4)[0]:.1f} {P(14-(10 if i==2 else 0),-28+i*10,4)[1]:.1f}" stroke="{K}" stroke-width="4" stroke-linecap="round"/>' for i in range(3))+mug(8,20,4,15,20))
for k,v in V.items(): open('kk_'+k+'.svg','w').write(v)
