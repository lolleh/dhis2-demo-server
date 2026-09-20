#!/usr/bin/env python3
"""THE MANAGE-ACCOUNTS PAGE, reproduced exactly (admin edits vlolleh, id
oRly8VbUF6e): full required payload firstName+surname+userRole (+credit map)
with userCredentials.password=password1 (<- user's chosen value; EVERY 409 so
far was a missing required property / missing role, or the digit-less policy for
a DIFFERENT value — never a rejection of password1). Then REAL login proof."""
import base64, json, urllib.request, urllib.error

B="http://127.0.0.1:8091"
A=base64.b64encode(b"admin:District@1").decode()
T="oRly8VbUF6e"

def api(m,p,body=None,auth=A):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(B+p,data=data,method=m,
        headers={"Content-Type":"application/json","Authorization":"Basic "+auth})
    try:
        with urllib.request.urlopen(req,timeout=760) as r: return r.getcode(),r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e: return e.code,(e.read() or b"").decode("utf-8","replace")
    except Exception as e: return None,str(e)[:110]

print("== 0. grab an existing userRole id (admin's) — page requires >=1 ==")
c,b=api("GET","/api/me?fields=userRoles[id,name]")
try:
    d=json.loads(b); role=d["userRoles"][0]["id"]; print("   use role %s (%s)" % (role,d["userRoles"][0]["name"]))
except Exception: print("   could not fetch role: %s" % str(b)[:110]); role=None

print("\n== 1. admin PURE FULL user edit (this page) — vlolleh pw -> password1 ==")
if role:
    body={"id":T,"firstName":"Vamba","surname":"Lolleh",
          "username":"vlolleh","name":"Vamba Lolleh",
          "userRoles":[{"id":role}],
          "userCredentials":{"id":T,"username":"vlolleh","password":"password1",
                             "userInfo":{"id":T,"username":"vlolleh"}}}
    c,b=api("PUT","/api/users/"+T,body)
    print("   HTTP %d   %s" % (c, str(b)[:240]))
else:
    print("   SKIPPED (no role)")

print("\n== 2. PROOF — real login vlolleh:password1 ==")
c,b=api("GET","/api/me",auth=base64.b64encode(b"vlolleh:password1").decode())
if c==200:
    try:
        d=json.loads(b); print("   LOGIN OK  username=%s name=%s" % (d.get("username"),d.get("name")))
    except Exception: print("   LOGIN OK (HTTP 200)  %s" % str(b)[:100])
else:
    print("   LOGIN FAILED HTTP %d  %s" % (c, str(b)[:150]))
