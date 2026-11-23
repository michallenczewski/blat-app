exec(open('gen.py').read().split("V={}")[0])
def blat2(x=14,y=46,w=132,h=66): return ext(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5"/>',(2,4,6),4.5)
V={}
V['6_kartka_kawa']=icon(blat2()+rot(-9,58,70,sheet(36,40,42,56))+cup(112,80))
V['7_zdjecia']=icon(blat2()+rot(-10,56,72,photo(34,42,42,48))+rot(7,98,80,photo(76,58,42,48)))
V['8_kartka_olowek']=icon(blat2()+rot(-8,60,72,sheet(38,40,44,58))+pen(96,104,-42))
V['9_zdjecie_kawa']=icon(blat2()+rot(-8,62,74,photo(38,40,48,56))+cup(114,82))
for k,v in V.items(): open(k+'.svg','w').write(v)
