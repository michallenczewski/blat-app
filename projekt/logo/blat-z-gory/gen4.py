exec(open('gen.py').read().split("V={}")[0])
def slab(x=28,y=26,s=104,steps=(2,4,6,8,10),rx=10): return ext(f'<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="{rx}"/>',steps,4.5)
small=lambda el,f=W: ext(el,(2,4),4.5,f)
flat=lambda el: f'<g fill="{K}">{el}</g>'
V={}
V['k1']=icon(slab()+rot(-10,72,70,small('<rect x="50" y="46" width="40" height="48" rx="3"/>')))
V['k2']=icon(slab()+small('<rect x="44" y="44" width="38" height="38" rx="3"/>')+small('<circle cx="102" cy="98" r="14"/>'))
V['k3']=icon(slab()+rot(-12,64,64,small('<rect x="42" y="42" width="40" height="48" rx="3"/>'))+rot(8,94,92,small('<rect x="74" y="70" width="40" height="44" rx="3"/>')))
V['k4']=icon(slab()+rot(-10,58,62,small('<rect x="20" y="40" width="58" height="46" rx="3"/>')))
V['k5']=icon(slab()+flat('<rect x="46" y="44" width="36" height="36" rx="3"/><circle cx="102" cy="98" r="13"/>'))
V['k6']=icon(slab()+flat('<circle cx="102" cy="58" r="14"/>'))
V['k7']=icon(slab()+rot(-10,80,76,flat('<rect x="60" y="54" width="40" height="46" rx="3"/>')))
V['k8']=icon(slab()+small('<rect x="46" y="46" width="44" height="44" rx="3"/>')+f'<circle cx="104" cy="100" r="13" fill="{K}"/>')
for k,v in V.items(): open(k+'.svg','w').write(v)
