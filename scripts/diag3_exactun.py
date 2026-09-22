#!/usr/bin/env python3
"""definitive. Read exact stored username (3 admin sources), then admin-page PUT
with EXACT username + password password1, then real login with EXACT un:password1."""
import base64, json, urllib.request, urllib.error

B="http://127.0.0.1:8091"
A="admin:"+base64.b64encode(b"District@1").decode()
T="oRly8VbUF6e"
def api(m,p,bdy=None,auth=A):
    data=json.dumps(bdy).encode() if bdy is not None else None
    req=urllib.request.Request(B+p,data=data,method=m,headers={
        "Content-Type":"application/json","Authorization":"Basic "+auth})
    try:
        with urllib.request.urlopen(req,timeout=720) as r: return r.getcode(),r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e: return e.code,(e.read() or b"").decode("utf-8","replace")
    except Exception as e: return None,str(e)[:110]

print("== 1. EXACT stored username, 3 sources (admin, no guesses) ==")
un=set()
for tag,p in (("userCredentials.username","/api/users/"+T+"?fields=userCredentials[username]"),
              ("userInfo.username","/api/users/"+T+"?fields=userInfo[username]"),
              ("top.username","/api/users/"+T+"?fields=username")):
    c,b=api("GET",p)
    print("   %-22s HTTP %s  %s" % (tag,c,str(b)[:120]))
    try:
        d=json.loads(b)
        for k in ("userCredentials","userInfo"):
            if isinstance(d.get(k),dict) and d[k].get("username"): un.add(d[k]["username"])
        if d.get("username"): un.add(d["username"])
    except Exception: pass
un=sorted(un)
print("\n   EXACT stored username(s): %s" % (un or "(none visible)"))
if not un:
    import sys; print("   ABORT — cannot derive exact username; no further guesses."); sys.exit(2)

U=un[0]
print("\n== 2. admin user-page PUT: username=%s password -> password1 (exact stored) ==")
pw=base64.b64encode((U+":password1").encode()).decode()
c,b=api("PUT","/api/me/changePassword",{"oldPassword":"password1","newPassword":"password1"},auth=pw)
print("   (self-check first — old=password1 via SAME me-session; expect policy 409 iff old right)")
c,b=api("GET","/api/users/"+T+"?fields=id,username&filter=username:eq:"+U)
if c==200:
    print("   admin sees EXACT un=%s as id %s — good" % (U, json.loads(b).get("id")))
else:
    print("   weird admin lookup HTTP %d %s" % (c,str(b)[:110]))

print("\n== 3. THE admin Manage-Accounts page!=full view — PUT user w/ userCredentials.password ==")
c,b=api("PUT","/api/26/users/"+T,{"id":T,"username":U,
      "userCredentials":{"id":T,"username":U,"password":"password1"}})
print("   PUT /api/26/users/%s -> HTTP %d  %s" % (T,c,str(b)[:150]))

print("\n== 4. PROOF — real login %s:password1 ==" % U)
c,b=api("GET","/api/me",auth=base64.b64encode((U+":password1").encode()).decode())
if c==200:
    try:
        d=json.loads(b); print("   PROVEN LOGIN username=%s name=%s" % (d.get("username"),d.get("name")))
    except Exception: print("   PROVEN LOGIN (HTTP 200)")
else:
    print("   STILL HTTP %d  %s" % (c,str(b)[:150]))
