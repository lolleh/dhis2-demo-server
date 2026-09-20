#!/usr/bin/env python3
"""Manage-Accounts-TRUE path: admin (currently District@1) edits account oRly8VbUF6e
= vlolleh, setting userCredentials.password = 'password1' (per user choice). This
is what the page does server-side. Print FULL import report. Then PROVE login
vlolleh:password1."""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
ADMIN = base64.b64encode(b"admin:District@1").decode()
T = "oRly8VbUF6e"  # vlolleh

def api(method, path, body=None, auth=ADMIN):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic "+auth})
    try:
        with urllib.request.urlopen(req, timeout=680) as r:
            return r.getcode(), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8", "replace")
    except Exception as e:
        return None, str(e)[:110]

print("== 1. admin edits vlolleh account: password1 (full import report) ==")
c, b = api("PUT", "/api/users/"+T,
           {"id": T, "username": "vlolleh",
            "userCredentials": {"username": "vlolleh", "password": "password1"}})
print("   HTTP %d\n   %s" % (c, str(b)[:500]))

print("\n== 2. PROOF — real login vlolleh:password1 ==")
c, b = api("GET", "/api/me", auth=base64.b64encode(b"vlolleh:password1").decode())
if c == 200:
    try:
        d = json.loads(b); print("   LOGIN OK username=%s name=%s" % (d.get("username"), d.get("name")))
    except Exception: print("   LOGIN OK (HTTP 200)  %s" % str(b)[:90])
else:
    print("   HTTP %d  %s" % (c, str(b)[:140]))
