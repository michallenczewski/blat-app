exec(open('gen.py').read().split("V={}")[0])
def slab(x=28,y=26,s=104,steps=(2,4,6,8,10),rx=10): return ext(f'<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="{rx}"/>',steps,4.5)
small=lambda el,f=W: ext(el,(2,4),4.5,f)
flat=lambda el: f'<g fill="{K}">{el}</g>'
cupf=lambda cx,cy,r=13,a=0: f'<g transform="rotate({a} {cx} {cy})" fill="{K}"><circle cx="{cx}" cy="{cy}" r="{r}"/><rect x="{cx+r-4}" y="{cy-4.5}" width="12" height="9" rx="4.5"/></g>'
ring=lambda cx,cy,r=13: f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{K}" stroke-width="3.2" stroke-dasharray="58 8 18 6"/>'
cupl=lambda cx,cy,r=14,a=0: f'<g transform="rotate({a} {cx} {cy})" fill="{W}" stroke="{K}" stroke-width="4.5"><rect x="{cx+r-4}" y="{cy-5}" width="13" height="10" rx="5"/><circle cx="{cx}" cy="{cy}" r="{r}"/></g><circle cx="{cx}" cy="{cy}" r="{r-6}" fill="{K}"/>'
pencilf=lambda x,y,a: f'<g transform="translate({x} {y}) rotate({a})" fill="{K}"><path d="M0 -5 H32 L42 0 L32 5 H0 a2 2 0 0 1 -2 -2 v-6 a2 2 0 0 1 2 -2Z"/></g>'
sq=lambda x,y,s,a: rot(a,x+s/2,y+s/2,flat(f'<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="3"/>'))
V={}
V['q1']=icon(slab()+sq(44,42,38,-9)+cupf(100,98,13,20))
V['q2']=icon(slab()+sq(18,34,46,-12)+cupf(102,96,13,-30))
V['q3']=icon(slab()+sq(46,42,36,-8)+cupf(98,96,13,15)+ring(108,62,11))
V['q4']=icon(slab()+sq(44,44,38,-7)+pencilf(76,108,-28))
V['q5']=icon(slab()+sq(42,40,36,-12)+sq(58,58,34,7)+cupf(106,100,11,40))
V['q6']=icon(slab()+sq(46,42,36,-8)+cupl(100,98,14,20))
V['q7']=icon(slab()+sq(50,50,34,-10)+cupf(118,52,13,30)+ring(94,104,10))
for k,v in V.items(): open(k+'.svg','w').write(v)
V={}
V['r1']=icon(slab()+sq(18,36,44,-11)+cupl(100,96,14,25))
V['r2']=icon(slab()+sq(44,44,38,-9)+cupl(118,108,15,-20))
V['r3']=icon(slab()+sq(40,38,34,-13)+sq(56,58,32,8)+cupl(104,100,13,30))
V['r4']=icon(slab()+sq(20,30,42,-10)+cupl(116,110,15,-15))
for k,v in V.items(): open(k+'.svg','w').write(v)
