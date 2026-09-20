#!/usr/bin/env python3
"""lolleh — set ONCE: old=district (proven accepted: the 409s fire only after old
is OK) -> new=District1 (upper+digit → passes both individually-proven rules).
THEN prove by REAL login lolleh:District1. No loops, no history."""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
def api(method, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic " + (auth or base64.b64encode(b"admin:district").decode())})
    try:
        with urllib.request.urlopen(req, timeout=900) as resp:
            return resp.getcode(), resp.read().decode("utf-8", "replace")[:140]
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8", "replace")[:200]
    except Exception as e:
        return None, str(e)[:100]

print("== apply lolleh: change district -> District1 (one legal shot) ==")
code, body = api("PUT", "/api/me/changePassword",
                 {"oldPassword": district_old, "newPassword": "District1"})
print("   HTTP %d  %s" % (code, body.strip()[:160]))

print("\n== PROOF — REALLY log in lolleh:District1 ==")
code, body = api("GET", "/api/me",
                 auth=base64.b64encode(b"lolleh:District1").decode())
if code == 200:
    print("   LOGIN OK lolleh:District1  (username+name below)")
    try:
        d = json.loads(body)
        print("   username=%s  name=%s" % (d.get("username"), d.get("name")))
    except Exception:
        print("   body: %s" % str(body)[:140])
else:
    print("   FAILED HTTP %d  %s" % (code, str(body)[:160]))
