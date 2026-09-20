#!/usr/bin/env python3
"""lolleh — assert REAL page change (old=district already proven live: only
policy-409s came back; and lolleh IS this instance's lolleh id oRly8VbUF6e).
Set new=District1 (upper+digit, passes this page's two live-observed rules).
THEN login lolleh:District1 to PROVE. Zero guessing."""

import base64, json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"

def api(method, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={
            "Content-Type":"application/json",
            "Authorization":"Basic " + (auth or ""),
        })
    try:
        with urllib.request.urlopen(req, timeout=720) as resp:
            return resp.getcode(), resp.read().decode("utf-8","replace")[:400]
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")[:200]
    except Exception as e:
        return None, str(e)[:120]

print("== 1. lolleh: district -> District1 (this page's own route; both DI1E rules proven) ==")
print("   admin=admin:district  target=lolleh")
code, body = api("PUT", "/api/me/changePassword",
                 {"username": "lolleh",
                  "oldPassword": "district",
                  "newPassword": "District1"})
print("   PUT /api/me/changePassword -> HTTP %s  %s" % (code, body[:160]))

print("\n== 2. PROOF — actually LOG IN lolleh:District1 ==")
code, body = api("GET", "/api/me", auth=base64.b64encode(b"lolleh:District1").decode())
if code == 200:
    print("   LOGIN OK lolleh:District1  %s" % body[:120])
else:
    print("   FAILED HTTP %s  %s" % (code, body[:160]))
