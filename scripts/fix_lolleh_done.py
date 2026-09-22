#!/usr/bin/env python3
"""ONE shot — the route an earlier live run ALREADY showed accepts lolleh/district
as old (returned policy-409 on new, never a bad-old-password error). newPassword
must contain a digit (page policy) -> 'password1'. Then REAL login lolleh:password1."""
import base64, json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"
A = base64.b64encode(b"admin:district").decode()

def api(method, path, body=None, uauth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic "+(uauth or A)})
    try:
        with urllib.request.urlopen(req, timeout=480) as resp:
            return resp.getcode(), resp.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")
    except Exception as e:
        return None, str(e)[:150]

print("== 1. lolleh: district -> password1 (route pre-proven: old district accepted) ==")
code, body = api("PUT", "/api/me/changePassword",
                 {"oldPassword": "district", "newPassword": "password1"})
print("   PUT changePassword -> HTTP %s  %s" % (code, body[:160]))

print("\n== 2. PROVE — log in AS lolleh:password1 ==")
code, body = api("GET", "/api/me", uauth=base64.b64encode(b"lolleh:password1").decode())
if code == 200:
    try:
        d = json.loads(body)
        print("   LOGIN OK  username=%s  name=%s" % (d.get("username"), d.get("name")))
    except Exception:
        print("   LOGIN OK  (HTTP 200)  %s" % body[:90])
else:
    print("   LOGIN FAILED HTTP %s  %s" % (code, body[:200]))
