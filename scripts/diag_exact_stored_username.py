#!/usr/bin/env python3
"""The ONE thing never done right: read exactly the STORED username (3 sources,
no guessing), then admin-page PUT with THAT exact value (password1), then login
with the EXACT stored username:password1."""
import base64, json, urllib.request, urllib.error
B="http://127.0.0.1:8091"
A=base64.b64encode(b"admin:District@1").decode()
T="oRly8VbUF6e"
def api(m,p,bdy=None,auth=A):
    data=json.dumps(bdy).encode() if bdy is not None else None
    rq=urllib.request.Request(B+p,data=data,method=m,headers={
        "Content-Type":"application/json","Authorization":"Basic "+auth})
    try:
        with urllib.request.urlopen(rq,timeout=760) as r: return r.getcode(),r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e: return e.code,(e.read() or b"").decode("utf-8","replace")
    except Exception as e: return None,str(e)[:110]

print("== 1. EXACT stored username — 3 admin read-sources ==")
un=set()
for src,p in [
  ("userCredentials.username","/api/users/"+T+"?fields=userCredentials[username]"),
  ("userInfo.username","/api/users/"+T+"?fields=userInfo[username]"),
  ("full user username","/api/users/"+T+"?fields=username")]:
    c,bb=api("GET",p)
    print("   %-24s HTTP %s  %s" % (src,c,str(bb)[:90]))
    try:
        d=json.loads(bb)
        for val in (d.get("userCredentials",{}).get("username"), d.get("userInfo",{}).get("username"), d.get("username")):
            if val: un.add(val)
    except Exception: pass
un=sorted(un)
print("\n   EXACT stored username(s) found: %s" % (un or "(NONE)"))
if not un:
    print("   ABORT — no username readable via normal fields; checking quirk:")
    PYEOF
