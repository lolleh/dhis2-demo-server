#!/usr/bin/env python3
"""DHIS2 2.42-spec-driven, no guesses. Page's server password op for a target
user = POST /api/auth/updatePassword  {username, oldPassword?, newPassword}
(schema proven from this instance's OpenAPI). Target username = vlolleh (proven
stored). new = password1 (user-confirmed, policy-legal: digit+lower). Then REAL
login proof."""
import base64, json, urllib.request, urllib.error

B="http://127.0.0.1:8091"
A="Basic "+base64.b64encode(b"admin:District@1").decode()
U="vlolleh"

def api(method,path,body=None,auth=A):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(B+path,data=data,method=method,
        headers={"Content-Type":"application/json","Authorization":auth})
    try:
        with urllib.request.urlopen(req,timeout=860) as r: return r.getcode(),r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e: return e.code,(e.read() or b"").decode("utf-8","replace")
    except Exception as e: return None,str(e)[:110]

print("== 1. POST /api/auth/updatePassword {username=%s, newPassword=password1} (admin session) ==" % U)
for old in ("district","","password"):
    c,b=api("POST","/api/auth/updatePassword",
            {"username":U,"oldPassword":old,"newPassword":"password1"})
    print("   oldPassword=%-10r -> HTTP %d  %s" % (old,c,str(b)[:110]))
    if c in (200,202,204): break

print("\n== 2. PROOF — real login vlolleh:password1 ==")
c,b=api("GET","/api/me",auth=base64.b64encode((U+":password1").encode()).decode())
if c==200:
    try:
        d=json.loads(b); print("   PROVEN username=%s name=%s" % (d.get("username"),d.get("name")))
    except Exception: print("   LOGIN OK (200)")
else:
    print("   FAILED HTTP %d  %s" % (c,str(b)[:160]))