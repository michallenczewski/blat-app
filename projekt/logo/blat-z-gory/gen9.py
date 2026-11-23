import re,glob
S=0.76
for f in sorted(glob.glob('p[1-8]_*.svg')):
    s=open(f).read()
    head,rest=s.split('fill="#FF6B1A"/>',1)
    body=rest.rsplit('</svg>',1)[0]
    out=head+'fill="#FF6B1A"/>'+f'<g transform="translate(80 80) scale({S}) translate(-80 -80)">{body}</g></svg>'
    open('m'+f[1:],'w').write(out)
