O='#FF6B1A'; L='#ECEBE6'; K='#161616'; SW=4.5
def ext(el, depth=8, steps=(2,4,6,8)):
    # wypchnięcie: czarne kopie przesunięte w dół, potem jasna powierzchnia z czarnym obrysem
    s=''.join(f'<g transform="translate(0 {d})" fill="{K}" stroke="{K}" stroke-width="{SW}" stroke-linejoin="round">{el}</g>' for d in steps if d<=depth)
    return s+f'<g fill="{L}" stroke="{K}" stroke-width="{SW}" stroke-linejoin="round">{el}</g>'
def icon(body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="38" fill="{O}"/>{body}</svg>'
def rot(a,cx,cy,inner): return f'<g transform="rotate({a} {cx} {cy})">{inner}</g>'
sheet=lambda x,y,w,h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3"/>'
lines=lambda x,y,w,n,g: ''.join(f'<path d="M{x} {y+i*g} H{x+w*(0.62 if i==n-1 else 1)}" stroke="{K}" stroke-width="5" stroke-linecap="round" fill="none"/>' for i in range(n))
def cup(cx,cy,r=24,depth=8):
    handle=f'<rect x="{cx+r-4}" y="{cy-6}" width="18" height="12" rx="6"/>'
    return ext(handle+f'<circle cx="{cx}" cy="{cy}" r="{r}"/>',depth)+f'<circle cx="{cx}" cy="{cy}" r="{r-8}" fill="{K}"/>'
V={}
# 1. kartka
V['1_kartka']=icon(rot(-8,80,78,ext(sheet(44,30,72,96))+lines(56,52,48,4,14)))
# 2. kawa na spodku
V['2_kawa']=icon(ext('<circle cx="78" cy="78" r="44"/>',5,(2,4,5))+cup(78,76,25,5))
# 3. kartka i kawa
V['3_kartka_kawa']=icon(rot(-9,66,74,ext(sheet(30,28,66,88))+lines(42,50,42,3,14))+cup(108,104,21))
# 4. dwa zdjęcia (referencje)
ph=lambda x,y,w,h: ext(sheet(x,y,w,h))+f'<rect x="{x+8}" y="{y+8}" width="{w-16}" height="{h-26}" fill="{K}"/>'
V['4_zdjecia']=icon(rot(-10,60,70,ph(28,34,62,70))+rot(7,98,92,ph(66,52,62,70)))
# 5. kartka i ołówek
pencil='<path d="M0 -7 H58 L72 0 L58 7 H0 Z"/>'
V['5_kartka_olowek']=icon(rot(-8,72,76,ext(sheet(34,30,70,92))+lines(46,52,46,3,14))+f'<g transform="translate(66 122) rotate(-38)">{ext(pencil,6,(2,4,6))}<path d="M58 -7 L72 0 L58 7" fill="none" stroke="{K}" stroke-width="{SW}" stroke-linejoin="round"/><path d="M66 -3 L72 0 L66 3Z" fill="{K}"/></g>')
for k,v in V.items(): open(k+'.svg','w').write(v)
