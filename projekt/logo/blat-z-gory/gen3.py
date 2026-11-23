exec(open('gen.py').read().split("V={}")[0])
def slab(x=18,y=46,w=124,h=68,steps=(2,4,6,8),rx=8): return ext(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"/>',steps,4.5)
small=lambda el,f=W: ext(el,(2,4),4.5,f)
V={}
# a: płyta i dwa prostokąty
V['a']=icon(slab()+small('<rect x="36" y="58" width="34" height="40" rx="3"/>')+small('<rect x="80" y="64" width="30" height="30" rx="3"/>'))
# b: płyta, kwadrat i koło
V['b']=icon(slab()+small('<rect x="40" y="60" width="36" height="36" rx="3"/>')+small('<circle cx="106" cy="78" r="15"/>'))
# c: płyta i jeden obrócony kwadrat
V['c']=icon(slab()+rot(-10,80,78,small('<rect x="62" y="60" width="36" height="36" rx="3"/>')))
# d: płyta i koło (czarne)
V['d']=icon(slab()+f'<circle cx="80" cy="78" r="15" fill="{K}"/>')
# e: dwie płyty jedna na drugiej (warstwy)
V['e']=icon(slab(26,62,108,56,(2,4,6,8))+slab(42,40,76,46,(2,4,6,8)))
# f: stół z boku z tych samych belek co kratka (blat i dwie nogi)
bars='M38 62 H122 M52 62 V122 M108 62 V122'
V['f']=icon(f'<g stroke="{K}" stroke-width="24" stroke-linecap="round" fill="none"><path d="{bars}" transform="translate(0 8)"/><path d="{bars}" transform="translate(0 5)"/><path d="{bars}" transform="translate(0 2)"/></g><path d="{bars}" stroke="{L}" stroke-width="15" stroke-linecap="round" fill="none"/>')
# g: stół z boku i kwadrat na blacie
V['g']=icon(f'<g stroke="{K}" stroke-width="24" stroke-linecap="round" fill="none"><path d="M34 76 H126 M50 76 V124 M110 76 V124" transform="translate(0 8)"/><path d="M34 76 H126 M50 76 V124 M110 76 V124" transform="translate(0 5)"/><path d="M34 76 H126 M50 76 V124 M110 76 V124" transform="translate(0 2)"/></g><path d="M34 76 H126 M50 76 V124 M110 76 V124" stroke="{L}" stroke-width="15" stroke-linecap="round" fill="none"/>'+small('<rect x="62" y="36" width="30" height="28" rx="3"/>',L))
for k,v in V.items(): open('s_'+k+'.svg','w').write(v)
