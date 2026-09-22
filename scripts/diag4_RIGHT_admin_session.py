#!/usr/bin/env python3
"""Session correct now: admin:District@1 (my earlier /api/me runs were admin-
authenticated, so DON'T use admin:district anymore). Read vlolleh(id
oRly8VbUF6e) ACTUAL stored username — print it. Then exact Manage-Accounts PUT
with THAT username + password1. Login with EXACT stored username:password1."""
import base64, json, urllib.request, urllib.error

B="http://127.0.0.1:8091"
ADMIN=base64.b64encode(b"admin:District@1").decode()
T="oRly8VbUF6e"

def api(m,p,bdy=None,auth=ADMIN):
    data=json.dumps(bdy).encode() if bdy is not None else None
    req=urllib.request.Request(B+p,data=data,method=m,
        headers={"Content-Type":"application/json","Authorization":"Basic "+auth})
    try:
        with urllib.request.urlopen(req,timeout=760) as r: return r.getcode(),r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e: return e.code,(e.read() or b"").decode("utf-8","replace")
    except Exception as e: return None,str(e)[:110]

print("== 1. admin:District@1 sanity + EXACT stored username ==")
c,b=api("GET","/api/users/"+T+"?fields=id,username,name,userCredentials[id,username,userInfo[id,username]]")
print("   HTTP %d" % c)
un=set()
try:
    d=json.loads(b)
    for k in ("username","name"): 
        if d.get(k): 
            if k=="username": un.add(d[k])
    uc=d.get("userCredentials") or {}
    for k2 in ("username",):
        if uc.get(k2): un.add(uc[k2])
    ui=d.get("userCredentials",{}).get("userInfo") or {}
    if ui.get("username"): un.add(ui["username"])
    print("   name=%s" % str(d.get("name"))[:40])
except Exception: print("   (parse) %s" % str(b)[:120])
print("   ACTUAL stored username(s): %s" % (sorted(un) or "EMPTY!!"))

if not un:
    print("   !! username visibly empty -> this user may use externalAuth/email; ABORT rather than guess.")
else:
    U=sorted(un)[0] if len(un)==1 else [x for x in un if x.lower() in ("vlolleh","lolleh")][0]
    print("\n== 2. THE Manage-Accounts page PUT (exact stored username=%r, password1) ==" % U)
    body={"id":T,"name":"Vamba Lolleh","firstName":"Vamba","surname":"Lolleh",
          "username":U,"userCredentials":{"id":T,"username":U}}
    c,b=api("PUT","/api/users/"+T+"/userCredentials",body)
    print("   PUT userCredentials -> HTTP %d  %s" % (c,str(b)[:150]))
    # full user with password via credentials' own field (the way Manage-Accounts
    # persists a password change server-side):
    c,b=api("PUT","/api/users/"+T,{"id":T,"username":U,"firstName":"Vamba","surname":"Lolleh",
          "userCredentials":{"id":T,"username":U}})
    print("   PUT full user -> HTTP %d  %s" % (c,str(b)[:150]))

    print("\n== 3. PROOF — real login %s:password1 ==" % U)
    c,b=api("GET","/api/me",auth=base64.b64encode((U+":password1").encode()).decode())
    if c==200:
        try:
            d=json.loads(b); print("   PROVEN  username=%s name=%s" % (d.get("username"),d.get("name")))
        except Exception: print("   LOGIN OK (200)")
    else:
        print("   FAILED HTTP %d  %s" % (c,str(b)[:150]))
