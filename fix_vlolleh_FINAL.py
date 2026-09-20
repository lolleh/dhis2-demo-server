#!/usr/bin/env python3
"""vlolleh -> password1, FINAL, user-confirmed. Complete Manage-Accounts-style
admin PUT (firstName, surname, one userRole, userCredentials with password).
Then PROVE real login vlolleh:password1. Admin session = admin:District@1 (my
earlier /api/me runs wore admin, that's why vlolleh reads 401'd under admin:district)."""
import base64, json, urllib.request, urllib.error

B="http://127.0.0.1:8091"
ADMIN=base64.b64encode(b"admin:District@1").decode()
T="oRly8VbUF6e"   # exact stored username: vlolleh
U="vlolleh"

def api(m,p,bdy=None,auth=ADMIN):
    data=json.dumps(bdy).encode() if bdy is not None else None
    req=urllib.request.Request(B+p,data=data,method=m,
        headers={"Content-Type":"application/json","Authorization":"Basic "+auth})
    try:
        with urllib.request.urlopen(req,timeout=860) as r: return r.getcode(),r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e: return e.code,(e.read() or b"").decode("utf-8","replace")
    except Exception as e: return None,str(e)[:110]

print("== 1. admin reads vlolleh/current role (page shows it) ==")
c,b=api("GET","/api/users/"+T+"?fields=id,username,name,userRoles[id,name],userGroupAccess,userCredentials[username,passwordLastUpdated]")
print("   HTTP %d  %s" % (c, str(b)[:220]))
role=None
try:
    d=json.loads(b)
    rl=d.get("userRoles") or []
    role=rl[0]["id"] if rl else None
    print("   -> name=%s username=%s role=%s" % (d.get("name"), (d.get("userCredentials") or {}).get("username"), (rl[0]["name"] if rl else None)))
except Exception: print("   (parse note) %s" % str(b)[:100])

print("\n== 2. admin Manage-Accounts PUT: username=%s password=password1 (full page payload) ==" % U)
body={"id":T,"name":"Vamba Lolleh","firstName":"Vamba","surname":"Lolleh",
      "username":U,"userRoles":([{"id":role}] if role else []),
      "userCredentials":{"id":T,"username":U,"password":"password1"}}
c,b=api("PUT","/api/users/"+T,body)
print("   HTTP %d  %s" % (c, str(b)[:200]))
import re
m=re.search(r'"stats":\{"(created|updated|deleted|ignored)":(\d+)',str(b))
print("   importStats:", m.group(1)+"="+m.group(2) if m else str(b)[:120])

print("\n== 3. PROOF — real login vlolleh:password1 ==")
c,b=api("GET","/api/me",auth=base64.b64encode(bytes(U+":password1","utf-8")).decode())
if c==200:
    try:
        d=json.loads(b); print("   PROVEN  username=%s name=%s" % (d.get("username"),d.get("name")))
    except Exception: print("   LOGIN OK (200)")
else:
    print("   FAILED HTTP %d  %s" % (c,str(b)[:160]))