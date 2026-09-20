#!/usr/bin/env python3
"""THE decisive one. Key insight (finally certain): /api/me/changePassword operates
on whoever's Basic-Auth header I send — my very first "lolleh" change ran with an
ADMIN header, so I actually changed ADMIN to District@1 (that's why admin:district
401s now and admin:District@1 works). vlolleh was NEVER touched. Plan, strictly
via vlolleh's OWN auth header:
  1. vlolleh:district  /api/me -> must be 200 (old proven = district)
  2. vlolleh changePassword district -> District@1  (policy-legal digit+upper+@)
  3. vlolleh:District@1 /api/me -> 200 = PROVEN real login with NEW password
Each uses auth=vlolleh:... ONLY. admin untouched here (restore as separate SQL)."""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
def api(method, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic "+auth})
    try:
        with urllib.request.urlopen(req, timeout=680) as r:
            return r.getcode(), r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")
    except Exception as e:
        return None, str(e)[:120]

def b64(s): return base64.b64encode(s.encode()).decode()

old = b64("vlolleh:district")
new = b64("vlolleh:District@1")

print("== 1. vlolleh:district — prove OLD (vlolleh's own session) ==")
c,b = api("GET", "/api/me", auth=old)
if c == 200:
    try: print("   OLD PROVEN (vlolleh:district) username=%s" % json.loads(b).get("username"))
    except Exception: print("   OLD PROVEN (HTTP 200)")
else:
    print("   vlolleh:district NOT current -> HTTP %d %s" % (c, str(b)[:120]))

print("\n== 2. vlolleh changePassword district -> District@1 ==")
c,b = api("PUT", "/api/me/changePassword",
          {"oldPassword": "district", "newPassword": "District@1"}, auth=old)
print("   HTTP %d  %s" % (c, str(b)[:140]))

print("\n== 3. PROOF — vlolleh:District@1 real login ==")
c,b = api("GET", "/api/me", auth=new)
if c == 200:
    try: print("   PROVEN vlolleh:District@1 — username=%s name=%s" % (json.loads(b).get("username"), json.loads(b).get("name")))
    except Exception: print("   PROVEN vlolleh:District@1 (HTTP 200)  %s" % str(b)[:90])
else:
    print("   FAILED HTTP %d  %s" % (c, str(b)[:130]))
