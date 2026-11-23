exec(open('pomoc.py').read())
import subprocess
from PIL import Image
def centroid(inner):
    open('_t.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#fff"/>{inner}</svg>')
    subprocess.run(['rsvg-convert','-w','320','-h','320','_t.svg','-o','_t.png'])
    im=Image.open('_t.png').convert('L'); px=im.load(); sx=sy=n=0
    for y in range(320):
        for x in range(320):
            if px[x,y]<200: sx+=x; sy+=y; n+=1
    return sx/n/2, sy/n/2
def single(inner, tx=80, ty=75):
    cx,cy=centroid(inner); return icon(slab()+f'<g transform="translate({tx-cx:.2f} {ty-cy:.2f})">{inner}</g>')
V={}
V['p1_ekierka']=single(G(54,48,-8,ekierka(62)))
V['p2_kubek']=single(G(74,76,-20,kubek(22).replace('stroke-width="4.5"','stroke-width="5.5"')))
V['p3_okulary']=single(G(80,82,-10,'<g transform="scale(1.45)">'+okulary()+'</g>'))
V['p4_olowek']=single(G(44,108,-40,'<g transform="scale(1.45)">'+olowek(60)+'</g>'))
V['p5_spinacz']=single(G(80,76,24,'<g transform="scale(1.7)">'+spinacz()+'</g>'))
V['p6_roslinka']=single(G(80,76,12,'<g transform="scale(1.55)">'+roslinka()+'</g>'))
V['p7_karteczka']=single(G(52,46,-8,karteczka(56)))
V['p8_linijka']=single(G(36,96,-38,'<g transform="scale(1.25)">'+linijka(74,16)+'</g>'))
for k,v in V.items(): open(k+'.svg','w').write(v)
