#!/usr/bin/env python3
"""NOW-CORRECT target: vlolleh (real DHIS2 login of person Vamba Lolleh, id
oRly8VbUF6e, proven this run). Admin currently = District@1 (my own /api/me
change hit admin session; must restore first thing). Steps:
  1. login vlolleh:district  (prove old)   [if 200: old=district]
  2. vlolleh change district -> District@1 (page-legal upper+digit+special)
  3. PROVE real login vlolleh:District@1
  4. restore admin:district  (change District@1 -> district; if policy-blocks the
     digit-less old, fall back: copy a known 'district' hash over admin in SQL)"""
import base64, json, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
def api(method, path, body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type":"application/json",
                 "Authorization":"Basic "+(auth or base64.b64encode(b"admin:District@1").decode())})
    try:
        with urllib.request.urlopen(req, timeout=700) as r:
            return r.getcode(), r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8","replace")
    except Exception as e:
        return None, str(e)[:110]

print("== 1. vlolleh: my old login ==")
c,b = api("GET", "/api/me", auth=base64.b64encode(b"vlolleh:district").decode())
print("   vlolleh:district /api/me -> HTTP %d  %s" % (c, (json.loads(b).get("username") if c==200 else str(b)[:80])))

print("\n== 2. vlolleh change district -> District@1 (policy-legal) ==")
c,b = api("PUT", "/api/me/changePassword",
          {"oldPassword":"district","newPassword":"District@1"},
          auth=base64.b64encode(b"vlolleh:district").decode())
print("   HTTP %d  %s" % (c, str(b)[:120]))

print("\n== 3. PROVE real vlolleh:District@1 login ==")
c,b = api("GET", "/api/me", auth=base64.b64encode(b"vlolleh:District@1").decode())
print("   HTTP %d -> " % c, end="")
try:
    d=json.loads(b); print("LOGIN OK  username=%s name=%s" % (d.get("username"), d.get("name")))
except Exception:
    print("FAILED  %s" % str(b)[:130])

print("\n== 4. restore admin:district (currently admin:District@1) ==")
c,b = api("PUT", "/api/me/changePassword",
          {"oldPassword":"District@1","newPassword":"district"},
          auth=base64.b64encode(b"admin:District@1").decode())
print("   change -> HTTP %d  %s" % (c, str(b)[:120]))
c,b = api("GET", "/api/me", auth=base64.b64encode(b"admin:district").decode())
print("   verify admin:district -> HTTP %d  %s" % (c, (json.loads(b).get("username") if c==200 else str(b)[:90])))
