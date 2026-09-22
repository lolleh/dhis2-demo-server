#!/usr/bin/env python3
"""SHORT-SHORT lolleh fix — SAME live page route (old=district legal NEW=password1
with digit), full verify. Nothing guessed: resolve by exact username filter."""
import base64, json, sys, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"
ADMIN = base64.b64encode(b"admin:district").decode()

def api(path, method="GET", body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type":"application/json",
                 "Authorization":"Basic "+(auth or ADMIN)})
    try:
        with urllib.request.urlopen(req, timeout=480) as r:
            raw = r.read().decode("utf-8","replace")
            try: return r.getcode(), json.loads(raw)
            except Exception: return r.getcode(), raw
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"").decode("utf-8","replace")
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw
    except Exception as e:
        return None, {"net": str(e)[:140]}

print("== 1. resolve lolleh BY EXACT USERNAME (authoritative) ==")
uid, un = None, None
for filt in ("username:eq:lolleh", "username:ieq:lolleh"):
    code, r = api("/api/users?filter=%s&fields=id,username&paging=false" % filt)
    if isinstance(r, dict):
        for u in (r.get("users") or []):
            if (u.get("username") or "").lower() == "lolleh":
                uid, un = u["id"], u["username"]; break
    if uid: print("   found id=%s username=%s (filter=%s)" % (uid, un, filt)); break
else:
    code, r = api("/api/users?fields=id,username,firstName,surname&paging=false")
    if isinstance(r, dict):
        for u in (r.get("users") or []):
            if (u.get("username") or "").lower() == "lolleh":
                uid, un = u["id"], u["username"]; break
    print("   (from full list) lolleh ->", uid or "NOT PRESENT")
if not uid:
    print("   ABORT: no user with exact username lolleh in live DHIS2")
    sys.exit(2)

print("\n== 2. apply password1 (old=district is PROVEN valid — the 409 said so) ==")
code, r = api("/api/me/changePassword", "PUT",
              {"oldPassword": "district", "newPassword": "password1"})
print("   PUT /api/me/changePassword -> HTTP %d  %s" % (code, str(r)[:200]))

print("\n== 3. VERIFY — actually LOG IN as lolleh:password1 ==")
code, r = api("/api/me", auth=base64.b64encode(b"lolleh:password1").decode())
if code == 200:
    print("   LOGIN OK  username=%s name=%s" % (
        (r or {}).get("username") if isinstance(r, dict) else "?", 
        (r or {}).get("name") if isinstance(r, dict) else str(r)[:80]))
else:
    print("   LOGIN FAILED HTTP %s  %s" % (code, str(r)[:200]))
