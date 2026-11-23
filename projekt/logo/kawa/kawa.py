exec(open('pomoc.py').read())
import subprocess
from PIL import Image
def center(inner, tx=80, ty=80):
    # środek ciężkości wszystkiego, co nie jest pomarańczowym tłem (z grubością)
    open('_t.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="{O}"/>{inner}</svg>')
    subprocess.run(['rsvg-convert','-w','320','-h','320','_t.svg','-o','_t.png'])
    im=Image.open('_t.png').convert('RGB'); px=im.load(); sx=sy=n=0
    for y in range(320):
        for x in range(320):
            r,g,b=px[x,y]
            if not (r>230 and 80<g<130 and b<60): sx+=x; sy+=y; n+=1
    cx,cy=sx/n/2,sy/n/2
    return icon(f'<g transform="translate({tx-cx:.2f} {ty-cy:.2f})">{inner}</g>')
def saucer(r, d=(2,4,6)): return ext(f'<circle cx="0" cy="0" r="{r}"/>', d, 4.5)
def cup(r, hang=0, d=(2,4,6), hw=13, hh=11):
    # uszko obrócone o kąt hang; filiżanka z grubością, kawa czarna
    h=f'<rect x="{r-5}" y="{-hh/2}" width="{hw+5}" height="{hh}" rx="{hh/2}" transform="rotate({hang})"/>'
    return ext(h+f'<circle r="{r}"/>', d, 4.5)+f'<circle r="{r-7}" fill="{K}"/>'
def at(x,y,inner,a=0): return f'<g transform="translate({x} {y}) rotate({a})">{inner}</g>'
spoon=lambda: ext('<path d="M0 -4 H26 a7 7 0 1 1 0 8 H0 a2 2 0 0 1 0 -8Z"/>',(1.5,3),3.6,W)
V={}
V['c1_klasyczna']=center(at(80,80,saucer(38))+at(80,78,cup(21,0)))
V['c2_bez_spodka']=center(at(80,80,cup(30,-35,(2,4,6,8),16,14)))
V['c3_lyzeczka']=center(at(80,80,saucer(38))+at(76,78,cup(20,-30))+at(92,100,spoon(),30))
V['c4_przesunieta']=center(at(80,80,saucer(38))+at(70,72,cup(20,-20)))
V['c5_espresso']=center(at(80,80,saucer(36))+at(80,78,cup(15,-40,(2,4),11,9)))
V['c6_kubek']=center(at(80,80,ext('<rect x="-10" y="-9" width="44" height="18" rx="9"/><circle r="30"/>',(2,4,6,8),5.5)+f'<circle r="21" fill="{K}"/>',20))
V['c7_kropla']=center(at(80,80,saucer(38))+at(78,78,cup(20,0))+f'<circle cx="104" cy="104" r="4.5" fill="{K}"/>')
V['c8_odblask']=center(at(80,80,saucer(38))+at(80,78,cup(21,-25))+f'<path d="M71 70 a11 11 0 0 1 9 -5" stroke="{L}" stroke-width="3.5" stroke-linecap="round" fill="none" transform="translate(0 0)"/>')
for k,v in V.items(): open(k+'.svg','w').write(v)
V={}
spoon2=lambda: ext('<path d="M0 -3 H16 a6.5 6.5 0 1 1 0 6 H0 a1.5 1.5 0 0 1 0 -6Z"/>',(1.5,3),3.4,W)
V['c3_lyzeczka']=center(at(80,80,saucer(40))+at(73,75,cup(19,-35))+at(86,104,spoon2(),-20))
V['c6_kubek']=center(at(80,80,ext('<rect x="22" y="-9" width="22" height="18" rx="9"/><circle r="30"/>',(2,4,6,8),5.5)+f'<circle r="21" fill="{K}"/>',-35))
V['c8_odblask']=center(at(80,80,saucer(38))+at(80,78,cup(21,-25)+f'<path d="M-9 -4 a10 10 0 0 1 6 -6" stroke="{L}" stroke-width="3.2" stroke-linecap="round" fill="none"/>'))
for k,v in V.items(): open(k+'.svg','w').write(v)
