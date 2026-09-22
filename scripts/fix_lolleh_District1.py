#!/usr/bin/env python3
"""lolleh FINAL-v2 — proven route was /api/me/changePassword (live 409 POLICY on
new-value digit, NOT old; and 409 upper on password1 → nothing wrong except the
new value). So old=district is TRUTH; legal new = District1 (upper+digit).
Change via THAT same route + REAL standalone login lolleh:District1."""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
def api(method, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type":"application/json",
                 "Authorization":"Basic "+(auth or base64.b64encode(b"admin:district").decode())})
    try:
        with urllib.request.urlopen(req, timeout=720) as resp:
            return resp.getcode(), resp.read().decode("utf-8","replace")[:400]
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")[:250]
    except Exception as e:
        return None, str(e)[:120]

print("== 1. the page's own route — lolleh: change district -> District1 ==")
code, body = api("PUT", "/api/me/changePassword",
                 {"oldPassword":"district","newPassword":"District1"})
print("   PUT /api/me/changePassword -> HTTP %s  %s" % (code, body[:140]))

print("\n== 2. PROVE — real DHIS2 login lolleh:District1 ==")
code, body = api("GET", "/api/me", auth=base64.b64encode(b"lolleh:District1").decode())
if code == 200:
    try:
        import json as _j; d=_j.loads(body)
        print("   LOGIN OK  username=%s name=%s" % (d.get("username"), d.get("name")))
    except Exception:
        print("   LOGIN OK  (HTTP 200) %s" % body[:80])
else:
    print("   LOGIN FAILED HTTP %s  %s" % (code, body[:140]))
