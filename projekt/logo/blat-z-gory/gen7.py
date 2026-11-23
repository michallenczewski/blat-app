exec(open('gen.py').read().split("V={}")[0])
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
V={}
V['o1']=icon(slab()+'<g transform="translate(9.6 0.9)">'+G(42,36,-6,ekierka())+G(70,104,-32,olowek())+'</g>')
V['o2']=icon(slab()+'<g transform="translate(-2 -4.3)">'+G(44,38,-8,ekierka(44))+G(102,96,20,kubek())+'</g>')
V['o3']=icon(slab()+'<g transform="translate(-6.5 2.8)">'+G(72,50,-10,okulary())+G(100,98,-25,kubek())+'</g>')
V['o4']=icon(slab()+'<g transform="translate(4.5 12)">'+G(44,40,-9,karteczka())+G(104,46,22,spinacz())+G(56,104,-20,olowek(50))+'</g>')
V['o5']=icon(slab()+'<g transform="translate(-5.8 3.2)">'+G(38,54,-14,linijka())+G(98,98,15,kubek())+'</g>')
V['o6']=icon(slab()+'<g transform="translate(12 6.5)">'+G(62,58,0,roslinka())+G(66,106,-24,olowek(52))+'</g>')
V['o7']=icon(slab()+'<g transform="translate(3 6.3)">'+G(40,34,-6,ekierka(40))+G(102,50,24,kubek(12))+G(54,108,-18,olowek(56))+'</g>')
V['o8']=icon(slab()+'<g transform="translate(3.6 1.4)">'+G(80,58,-12,okulary())+G(52,106,-20,olowek(56))+'</g>')
for k,v in V.items(): open(k+'.svg','w').write(v)
