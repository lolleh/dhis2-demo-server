#!/usr/bin/env python3
"""FINAL lolleh (DHIS2 user) fix — ONE authoritative wait, admin-set-password path
(exact endpoints the Manage Accounts page uses when an admin edits another user):
  1) resolve lolleh via TOP-LEVEL filter fields (username/firstName/surname are the
     users-collection's own fields — userCredentials.username is NOT a valid query
     key, that is exactly why the 400s happened);
  2) set new password via the admin route that does NOT need the old password:
     POST /api/users/{id}/changePassword  {newPassword}
  3) VERIFY by authenticating AS lolleh:password to /api/me (login proof, not fields)."""
import base64, json, sys, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"
AUTH = base64.b64encode(b"admin:district").decode()
NEW  = "password"

def api(path, method="GET", body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type":"application/json",
                 "Authorization":"Basic "+(auth or AUTH)})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            raw = resp.read().decode("utf-8","replace")
            try: return resp.getcode(), json.loads(raw)
            except Exception: return resp.getcode(), raw
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"").decode("utf-8","replace")
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw
    except Exception as e:
        return None, {"net": str(e)[:150]}

print("== 1. resolve lolleh — TOP-LEVEL fields only (authoritative page filter shape) ==")
users = None
for filt in ("username:eq:lolleh", "username:ieq:lolleh", "query=lolleh"):
    q = ("filter=" + filt) if not filt.startswith("query") else filt
    code, r = api("/api/users?%s&fields=id,username,firstName,surname&paging=false" % q)
    if isinstance(r, dict):
        users = (r or {}).get("users", [])
        if users:
            print("   filter=%s -> HTTP %d  found=%d" % (filt, code, len(users)))
            break
        print("   filter=%s -> HTTP %d  0 matches (not forbidden, just none)" % (filt, code))
    else:
        print("   filter=%s -> HTTP %s  %s" % (filt, code, str(r)[:120]))
if not users:
    print("\n   ABORT: no user in this DHIS2 resolves to 'lolleh' under any top-level "
          "exact filter — refusing to invent one.")
    # still dump the real top-level usernames so the owner can see what DOES exist:
    code, r = api("/api/users?fields=id,username&paging=false")
    us = (r.get("users") or []) if isinstance(r, dict) else []
    print("   (live usernames present: %s)" % ", ".join(u.get("username") for u in us[:60]))
    sys.exit(2)

uid = users[0]["id"]
print("   -> user id=%s username=%s %s %s" % (uid, users[0].get("username"),
                                              users[0].get("firstName"), users[0].get("surname")))

print("\n== 2. set password (admin route, no old-password needed) ==")
code, r = api("/api/users/%s/changePassword" % uid, "POST", {"newPassword": NEW})
print("   POST /api/users/%s/changePassword -> HTTP %d  %s" % (uid, code, str(r)[:160]))
if str(code) not in ("200","201","204"):
    print("   fallback: userAccount/password route ==")
    code, r = api("/api/userAccount/password", "POST",
                  {"username": "lolleh", "newPassword": NEW})
    print("   -> HTTP %d  %s" % (code, str(r)[:200]))

print("\n== 3. VERIFY: log in AS lolleh:password ==")
code, r = api("/api/me", auth=base64.b64encode(b"lolleh:"+NEW.encode()).decode())
if code == 200 and isinstance(r, dict):
    print("   LOGIN OK — username=%s name=%s" % (r.get("username"), r.get("name")))
else:
    print("   LOGIN FAILED: HTTP %s  %s" % (code, str(r)[:200]))
