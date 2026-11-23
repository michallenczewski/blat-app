O='#FF6B1A'; L='#ECEBE6'; W='#FBFAF7'; K='#161616'
def ext(el, steps, sw, fill=L):
    s=''.join(f'<g transform="translate(0 {d})" fill="{K}" stroke="{K}" stroke-width="{sw}" stroke-linejoin="round">{el}</g>' for d in steps)
    return s+f'<g fill="{fill}" stroke="{K}" stroke-width="{sw}" stroke-linejoin="round">{el}</g>'
def icon(body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="38" fill="{O}"/>{body}</svg>'
rot=lambda a,cx,cy,i: f'<g transform="rotate({a} {cx} {cy})">{i}</g>'
# sam blat: jasny prostokąt z czarną grubością (krawędź blatu)
def blat(x=20,y=34,w=120,h=84): return ext(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7"/>',(2,4,6,8,10,12),4.5)
def sheet(x,y,w,h,nl=3):
    s=ext(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2"/>',(1.5,3),3.5,W)
    for i in range(nl): s+=f'<path d="M{x+8} {y+11+i*9} H{x+w-8-(10 if i==nl-1 else 0)}" stroke="{K}" stroke-width="3.5" stroke-linecap="round"/>'
    return s
def photo(x,y,w,h):
    return ext(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2"/>',(1.5,3),3.5,W)+f'<rect x="{x+5}" y="{y+5}" width="{w-10}" height="{h-16}" fill="{K}"/>'
def cup(cx,cy,r=13):
    return ext(f'<rect x="{cx+r-3}" y="{cy-4}" width="11" height="8" rx="4"/><circle cx="{cx}" cy="{cy}" r="{r}"/>',(1.5,3),3.5,W)+f'<circle cx="{cx}" cy="{cy}" r="{r-5}" fill="{K}"/>'
pencil='<path d="M0 -4.5 H34 L43 0 L34 4.5 H0 Z"/>'
def pen(x,y,a): return f'<g transform="translate({x} {y}) rotate({a})">'+ext(pencil,(1.5,3),3.2,W)+f'<path d="M34 -4.5 L43 0 L34 4.5" fill="none" stroke="{K}" stroke-width="3.2" stroke-linejoin="round"/></g>'
# blat kwadratowy; cały blok (płyta + grubość 10) wyśrodkowany w pionie: 23..137
def slab(x=28,y=23,s=104,steps=(2,4,6,8,10),rx=10): return ext(f'<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="{rx}"/>',steps,4.5)
G=lambda x,y,a,inner: f'<g transform="translate({x} {y}) rotate({a})">{inner}</g>'
def ekierka(s=46): 
    h=s*0.3; return f'<path fill-rule="evenodd" fill="{K}" d="M0 0 L0 {s} L{s} {s} Z M{s*0.15} {s*0.38} L{s*0.15} {s*0.85} L{s*0.62} {s*0.85} Z"/>'
def olowek(l=54):
    return f'<path fill="{K}" d="M0 -5 H{l-12} L{l} 0 L{l-12} 5 H0 a2 2 0 0 1 -2 -2 v-6 a2 2 0 0 1 2 -2Z"/><path d="M{l-12} -6 V6" stroke="{L}" stroke-width="2"/><path d="M{l-4} -1.6 L{l} 0 L{l-4} 1.6Z" fill="{L}"/>'
def kubek(r=14): return f'<g fill="{W}" stroke="{K}" stroke-width="4.5"><rect x="{r-4}" y="-5" width="13" height="10" rx="5"/><circle r="{r}"/></g><circle r="{r-6}" fill="{K}"/>'
def okulary(r=10): return f'<g fill="none" stroke="{K}" stroke-width="4.5" stroke-linecap="round"><circle cx="{-r-3}" r="{r}"/><circle cx="{r+3}" r="{r}"/><path d="M-3 -2 Q0 -5 3 -2"/><path d="M{-2*r-3} -2 L{-2*r-8} -16 M{2*r+3} -2 L{2*r+8} -16"/></g>'
def spinacz(): return f'<path d="M4 18 V-14 a7 7 0 0 1 14 0 V22 a10 10 0 0 1 -20 0 V-6" fill="none" stroke="{K}" stroke-width="3.6" stroke-linecap="round"/>'
def karteczka(s=32): f=10; return f'<path fill="{K}" d="M0 0 H{s} V{s-f} L{s-f} {s} H0 Z"/><path fill="{L}" d="M{s} {s-f} L{s-f} {s-f} L{s-f} {s} Z" stroke="{K}" stroke-width="2.5" stroke-linejoin="round"/>'
def linijka(l=74,h=14): return f'<rect x="0" y="0" width="{l}" height="{h}" rx="2" fill="{K}"/>'+''.join(f'<path d="M{6+i*8} 0 V{6 if i%2 else 9}" stroke="{L}" stroke-width="2"/>' for i in range(9))
def roslinka(): return ''.join(f'<ellipse cx="0" cy="-12" rx="6" ry="13" fill="{K}" transform="rotate({a})"/>' for a in range(0,360,60))+f'<circle r="5" fill="{L}"/>'
