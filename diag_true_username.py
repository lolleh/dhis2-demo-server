#!/usr/bin/env python3
"""READ-ONLY truth — after the successful page PUT (updated=1): what is the
REAL stored username now, and did the password update really land? Extract
exact username from userCredentials + userInfo + userCredentials.ldapId?(no),
+ username via userInfo. Then try login with THAT exact stored username."""
import base64, json, urllib.request, urllib.error
B="http://127.0.0.1:8091"
import base64
A=base64.b64encode(b"admin:District@1").decode()
T="oRly8VbUF6e"
def api(m,p,auth=A,body=None):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(B+p,data=data,method=m,headers={"Content-Type":"application/json","Authorization":"Basic "+auth})
    try:
        with urllib.request.urlopen(req,timeout=760) as r: return r.getcode(),r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e: return e.code,(e.read() or b"").decode("utf-8","replace")
    except Exception as e: return None,str(e)[:100]

c,b=api("GET","/api/users/"+T+"?fields=id,username,name,"\
       "userCredentials[id,username,externalAuth,passwordLastUpdated,userInfo[username]]")
print("== STORED TRUTH for oRly8VbUF6e ==")
print("   HTTP %d  %s" % (c, str(b)[:330]))

# derive every username the object carries
names=set()
try:
    d=json.loads(b); q=d.get("username")
    uc=d.get("userCredentials") or {}
    for k in ("username","userInfo"):
        v=uc.get(k)
        if isinstance(v,str): names.add(v)
        elif isinstance(v,dict) and v.get("username"): names.add(v["username"])
    if q: names.add(q)
except Exception as e: print("   parse: %s" % str(e)[:80])
print("\n== try REAL login with each exact stored username + password1 ==")
for un in sorted(names):
    c2,b2=api("GET","/api/me",auth=base64.b64encode((un+":password1").encode()).decode())
    print("   %-24s:password1 -> HTTP %d  %s" % (un,c2, ("LOGIN OK!" if c2==200 else str(b2)[:70])))
if not names:
    print("   (could not derive any username from response — raw: %s)" % str(b)[:140])
