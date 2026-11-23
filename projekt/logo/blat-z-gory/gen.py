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
V={}
V['1_blat_kartka_kawa']=icon(blat()+rot(-8,62,74,sheet(40,46,42,56))+cup(110,72))
V['2_blat_kartka']=icon(blat()+rot(-7,80,74,sheet(56,44,48,60,4)))
V['3_blat_zdjecia']=icon(blat()+rot(-8,58,72,photo(36,46,42,48))+rot(6,98,78,photo(76,52,42,48)))
V['4_blat_kartka_olowek']=icon(blat()+rot(-6,64,74,sheet(42,46,44,58))+pen(92,96,-50))
V['5_blat_zdjecie_kawa']=icon(blat()+rot(-7,64,74,photo(40,46,48,54))+cup(112,74))
for k,v in V.items(): open(k+'.svg','w').write(v)
