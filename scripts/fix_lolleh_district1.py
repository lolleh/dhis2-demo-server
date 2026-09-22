#!/usr/bin/env python3
"""lolleh FINAL-FINAL — change lolid district->District1 via /api/me/changePassword
(route + old=district both PROVEN live by the 409s). new is state-legal (digit AND
upper → satisfies the two policy 409s we actually got). Then PROVE by real login."""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
A = base64.b64encode(b"admin:district").decode()

def api(method, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type":"application/json",
                 "Authorization":"Basic "+(auth or A)})
    try:
        with urllib.request.urlopen(req, timeout=900) as resp:
            return resp.getcode(), resp.read().decode("utf-8","replace")[:400]
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")[:250]
    except Exception as e:
        return None, str(e)[:130]

print("== 1. lolleh change district -> District1 (the page route; old=district legal) ==")
code, body = api("PUT", "/api/me/changePassword",
                 {"oldPassword":"district","newPassword":"District1"})
print("   HTTP %s  %s" % (code, body[:170]))

print("\n== 2. PROVE — REAL login lolleh:District1 ==")
code, body = api("GET", "/api/me", auth=base64.b64encode(b"lolleh:District1").decode())
print("   HTTP %s" % code)
if code == 200:
    try:
        import json as j; d=j.loads(body)
        print("   LOGIN OK — username=%s name=%s" % (d.get("username"), d.get("name")))
    except Exception:
        print("   LOGIN OK  (200)  %s" % body[:90])
else:
    print("   login unavailable: %s" % body[:160])
