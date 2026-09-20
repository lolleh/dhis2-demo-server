#!/usr/bin/env python3
"""lolleh password is 'password' — ALL-IN-ONE, no route invention:
 route = PUT /api/me/changePassword  (this instance's OWN OpenAPI; found above)
 oldPassword = demo seed (try 'district' then 'Admin123'), newPassword='password';
 ACCEPTANCE = actually log in as lolleh:password via /api/me. compact lines."""
import base64, json, urllib.request, urllib.error

BASE="http://127.0.0.1:8091"; AUTH=base64.b64encode(b"admin:district").decode()

def api(path, method="GET", body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type":"application/json","Authorization":"Basic "+(auth or AUTH)})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.getcode(), resp.read().decode("utf-8","replace")[:400]
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")[:300]
    except Exception as e:
        return None, str(e)[:150]

for old in ("district","Admin123","password"):
    code, body = api("/api/me/changePassword","PUT",
        {"oldPassword": old, "newPassword": "password"})
    note = "HTTP %s" % code
    if str(code) in ("200","201","204"):
        print("   changePassword(old=%s) -> %s  OK" % (old, note))
        break
    print("   changePassword(old=%s) -> %s  body=%s" % (old, note, body.strip()[:120]))
else:
    print("   all seed old-passwords rejected; trying openapi-hinted userAccount/password via me ==")
    code, body = api("/api/me/changePassword","PUT",{"newPassword":"password"})
    print("   -> HTTP %s %s" % (code, body[:160]))

print("\n== ACCEPTANCE: log in as lolleh:password ==")
code, body = api("/api/me", auth=base64.b64encode(b"lolleh:password").decode())
print("   HTTP %s" % code)
if code == 200:
    try: me=json.loads(body); print("   OK  username=%s name=%s" % (me.get("username"), me.get("name")))
    except Exception: print("   OK  (login accepted)")
else:
    print("   FAILED:", body[:200])
