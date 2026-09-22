#!/usr/bin/env python3
"""Manage Accounts page-equivalent, done carefully (admin, id-proven TARGET=vlolleh):
  1. PUT /api/users/oRly8VbUF6e with ONLY userCredentials changes
     {username:"vlolleh", password:"password1"}  -> full importSummary printed
  2. login PROOF vlolleh:password1
admin hears admin:District@1 (my earlier /api/me run broke admin:district)."""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
ADMIN = base64.b64encode(b"admin:District@1").decode()
T = "oRly8VbUF6e"

def api(method, path, body=None, auth=ADMIN):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic "+auth})
    try:
        with urllib.request.urlopen(req, timeout=760) as r:
            return r.getcode(), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8", "replace")
    except Exception as e:
        return None, str(e)[:110]

print("== 1. admin -> PUT vlolleh userCredentials (username+password) ==")
c, b = api("PUT", "/api/users/"+T,
           {"id": T, "username": "vlolleh",
            "userCredentials": {"username": "vlolleh", "password": "password1"}})
print("   HTTP %d" % c)
try:
    d = json.loads(b)
    if "response" in d:
        r = d["response"]
        print("   importSummary: status=%s imported=%s updated=%s deleted=%s ignored=%s" % (
            r.get("status"), r.get("imported"), r.get("updated"),
            r.get("deleted"), r.get("ignored")))
        for m in (r.get("conflicts") or [])[:6]:
            print("   conflict: %s" % str(m)[:150])
    else:
        print("   body: %s" % str(b)[:260])
except Exception:
    print("   non-JSON/raw: %s" % str(b)[:260])

print("\n== 2. PROOF — real login vlolleh:password1 ==")
c, b = api("GET", "/api/me", auth=base64.b64encode(b"vlolleh:password1").decode())
if c == 200:
    try:
        d = json.loads(b); print("   LOGIN OK  username=%s name=%s" % (d.get("username"), d.get("name")))
    except Exception:
        print("   LOGIN OK (HTTP 200)  %s" % str(b)[:100])
else:
    print("   LOGIN FAILED HTTP %d  %s" % (c, str(b)[:150]))
