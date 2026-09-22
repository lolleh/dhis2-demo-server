#!/usr/bin/env python3
"""lolleh fix FINAL — the page's own proven route. Live-verified twice already:
PUT /api/me/changePassword with oldPassword=district -> HTTP 409 (policy on NEW
value only: needs upper case + digit). So old=district IS lolleh's current pw.
new=District1 (upper+digit, policy-legal). Then PROVE by actually logging in."""
import base64, json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"

def api(method, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic " + (auth or base64.b64encode(b"admin:district").decode())})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.getcode(), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8", "replace")
    except Exception as e:
        return None, str(e)[:120]

print("== 1. lolleh: district -> District1 (page route, policy-legal) ==")
code, body = api("PUT", "/api/me/changePassword",
                 {"oldPassword": "district", "newPassword": "District1"})
print("   PUT /api/me/changePassword -> HTTP %s  %s" % (code, body[:120]))

print("\n== 2. PROOF: real DHIS2 login as lolleh:District1 ==")
code, body = api("GET", "/api/me",
                 auth=base64.b64encode(b"lolleh:District1").decode())
if code == 200:
    print("   LOGIN OK  lolleh:District1")
elif code == 401:
    print("   LOGIN FAILED (policy still blocking) HTTP 401")
else:
    print("   HTTP %s  %s" % (code, body[:120]))
