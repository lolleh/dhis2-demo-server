#!/usr/bin/env python3
"""vlolleh = REAL target (Vamba Lolleh, id oRly8VbUF6e, username VLOLlEH - proven
via admin session /api/me in-managed-account probe). Steps strictly vlolleh:
  1. prove vlolleh:district old
  2. change vlolleh: district -> District@1 (page-legal: upper+digit+special)
  3. PROVE real login vlolleh:District@1
  4. restore admin (I changed admin session by accident earlier): District@1 -> district"""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
def call(m, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=m,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic " + (auth or base64.b64encode(b"admin:District@1").decode())})
    try:
        with urllib.request.urlopen(req, timeout=700) as r:
            return r.getcode(), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8", "replace")[:260]
    except Exception as e:
        return None, str(e)[:110]

VL = base64.b64encode(b"vlolleh:district").decode()
print("== 1. prove vlolleh:district (old) ==")
c, b = call("GET", "/api/me", auth=VL)
print("   vlolleh:district /api/me -> HTTP %d  %s" % (c, (json.loads(b).get("username") if c==200 else str(b)[:90])))

print("\n== 2. change vlolleh: district -> District@1 ==")
c, b = call("PUT", "/api/me/changePassword",
            {"oldPassword": "district", "newPassword": "District@1"}, auth=VL)
print("   -> HTTP %d  %s" % (c, str(b)[:130]))

print("\n== 3. PROVE real login vlolleh:District@1 ==")
c, b = call("GET", "/api/me", auth=base64.b64encode(b"vlolleh:District@1").decode())
if c == 200:
    print("   LOGIN OK  username=%s" % json.loads(b).get("username"))
else:
    print("   LOGIN FAILED HTTP %d  %s" % (c, str(b)[:130]))

print("\n== 4. restore admin (District@1 -> district) ==")
c, b = call("PUT", "/api/me/changePassword",
            {"oldPassword": "District@1", "newPassword": "district"},
            auth=base64.b64encode(b"admin:District@1").decode())
print("   -> HTTP %d  %s" % (c, str(b)[:130]))
c, b = call("GET", "/api/me", auth=base64.b64encode(b"admin:district").decode())
print("   verify admin:district -> HTTP %d  %s" % (c, (json.loads(b).get("username") if c==200 else str(b)[:90])))
