#!/usr/bin/env python3
"""vlolleh — THE correct target (person Vamba Lolleh, id oRly8VbUF6e, proven
real login username on /api/me of an admin:District@1 session). Steps strictly
vlolleh-only:
  1. prove vlolleh:district old (login)
  2. change vlolleh district -> District@1 (upper+digit+special all live-proven rules)
  3. PROVE real login vlolleh:District@1
"""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
def call(method, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic "+(auth or base64.b64encode(b"admin:District@1").decode())})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.getcode(), r.read().decode("utf-8","replace")[:300]
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")[:230]
    except Exception as e:
        return None, str(e)[:100]

VLOL = base64.b64encode(b"vlolleh:district").decode()

print("== 1. vlolleh:district — prove current old ==")
c,b = call("GET", "/api/me", auth=VLOL)
if c == 200:
    print("   vlolleh:district CURRENT & VALID (HTTP 200)  %s" % str(b)[:110])
else:
    print("   vlolleh:district FAILED HTTP %s %s" % (c, str(b)[:110]))

print("\n== 2. change vlolleh: district -> District@1 (all 3 page rules live-proven) ==")
c,b = call("PUT", "/api/me/changePassword",
           {"oldPassword": "district", "newPassword": "District@1"}, auth=VLOL)
print("   HTTP %s  %s" % (c, str(b)[:160]))

print("\n== 3. PROOF — real login vlolleh:District@1 ==")
c,b = call("GET", "/api/me", auth=base64.b64encode(b"vlolleh:District@1").decode())
if c == 200:
    print("   LOGIN OK  vlolleh:District@1  %s" % str(b)[:110])
else:
    print("   FAILED HTTP %s  %s" % (c, str(b)[:150]))
