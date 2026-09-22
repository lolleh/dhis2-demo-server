#!/usr/bin/env python3
"""READ-ONLY diagnostic — reproduce the EXACT admin->user PUT the Manage-Accounts
page does, but print the FULL 409 importSummary (response.importSummary incl.
messages + conflicts). NO password is set here; this only tells us why that route
409s (that's the real blocker we've been missing)."""
import base64, json, urllib.request, urllib.error

B="http://127.0.0.1:8091"
ADMIN=base64.b64encode(b"admin:District@1").decode()
T="oRly8VbUF6e"

def api(method,path,body=None,auth=ADMIN):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(B+path,data=data,method=method,
        headers={"Content-Type":"application/json","Authorization":"Basic "+auth})
    try:
        with urllib.request.urlopen(req,timeout=760) as r:
            return r.getcode(), r.read().decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        return e.code,(e.read() or b"").decode("utf-8","replace")
    except Exception as e:
        return None,str(e)[:110]

c,b=api("PUT","/api/users/"+T,{"id":T,"username":"vlolleh",
    "userCredentials":{"username":"vlolleh","password":"password1"}})
print("PUT /api/users/oRly8VbUF6e (admin->vlolleh pw=password1) -> HTTP %d" % c)
try:
    d=json.loads(b)
    r=d.get("response") or {}
    print("\n  importSummary: (no response -> %s)" % (str(b)[:140] if not r else "ok"))
    if r:
        for k in ("status","imported","updated","deleted","ignored","description","importOptions"):
            if k in r: print("   %-14s %s" % (k, str(r[k])[:120]))
        msgs=r.get("messages") or r.get("conflicts") or []
        print("   messages/conflicts: %d" % len(msgs))
        for m in msgs[:14]:
            print("      - %s" % str(m)[:180])
except Exception as e:
    print("   raw: %s" % str(b)[:400])
