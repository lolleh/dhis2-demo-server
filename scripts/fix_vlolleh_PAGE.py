#!/usr/bin/env python3
"""TRUE page-equivalent: admin (via Manage Accounts) sets vlolleh's
userCredentials.password directly on the user resource (this is what the page
does server-side for another user — no oldPassword involved, admin authority).
Then PROVE with a real vlolleh:District@1 login. Uses admin:District@1
(current live admin creds, proven 200 earlier)."""
import base64, json, urllib.request, urllib.error, urllib.parse

B = "http://127.0.0.1:8091"
ADMIN = base64.b64encode(b"admin:District@1").decode()
TARGET = "oRly8VbUF6e"   # vlolleh  (Vamba Lolleh — username proven live)

def api(method, path, body=None, auth=ADMIN):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Accept": "application/json",
                 "Authorization": "Basic "+auth})
    try:
        with urllib.request.urlopen(req, timeout=640) as r:
            return r.getcode(), r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")
    except Exception as e:
        return None, str(e)[:110]

print("== 1. vlolleh current (admin view, real username) ==")
c,b = api("GET", "/api/users/"+TARGET+"?fields=id,username,name,userCredentials[username,userInfo.username,passwordLastUpdated]")
print("   HTTP %d  %s" % (c, str(b)[:200]))

print("\n== 2. ADMIN sets vlolleh userCredentials.password = District@1 ==")
c,b = api("PUT", "/api/users/"+TARGET,
          {"username": "vlolleh",
           "userCredentials": {"username": "vlolleh", "password": "District@1"}})
print("   HTTP %d  %s" % (c, str(b)[:160]))

print("\n== 3. PROOF — REAL vlolleh:District@1 login ==")
c,b = api("GET", "/api/me", auth=base64.b64encode(b"vlolleh:District@1").decode())
if c == 200:
    try: print("   PROVEN! username=%s name=%s organisations=%s" % (
        json.loads(b).get("username"), json.loads(b).get("name"),
        [o.get("id") for o in json.loads(b).get("organisationUnits",[])]))
    except Exception: print("   PROVEN! HTTP 200  %s" % str(b)[:110])
else:
    print("   FAILED HTTP %d  %s" % (c, str(b)[:160]))
