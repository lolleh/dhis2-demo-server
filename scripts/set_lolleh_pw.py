#!/usr/bin/env python3
"""lolleh account fix — ONE pass, live DHIS2:
 (1) resolve by the EXACT filter the Manage Accounts page uses
     (filter=userCredentials.username:ieq:lolleh — resolves case-insensitively,
      zero guesses, no username:ilike guessing);
 (2) if exactly one user -> change password the way /userAccount/password route does
     (new=password) via changePassword endpoint;
 (3) VERIFY by re-issuing Basic auth as lolleh:password against /api/me (login proof,
     not a fields-parsing guess). Prints compact lines only."""
import base64, json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"
AUTH = base64.b64encode(b"admin:district").decode()

def api(method, path, body=None, auth=None, out="json", timeout=240):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type":"application/json",
                 "Authorization":"Basic "+(auth or AUTH)})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            if out=="raw": return resp.getcode(), raw.decode("utf-8","replace")
            try: return resp.getcode(), json.loads(raw)
            except Exception: return resp.getcode(), raw.decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"")
        if out=="raw": return e.code, raw.decode("utf-8","replace")
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw.decode("utf-8","replace")
    except Exception as e:
        return None, {"net": str(e)[:150]}

print("== 1. resolve lolleh — exact page-equivalent filter, no username guessing ==")
ALLOWED = ("userCredentials.username:ieq:lolleh", "lolleh", "lolleh")
for cand in ALLOWED:
    code, r = api("GET", "/api/users?filter=%s&fields=userCredentials[id,username],firstName,surname&paging=false" % cand)
    users = (r or {}).get("users", []) if isinstance(r, dict) else []
    if users:
        print("   filter=%s -> %d" % (cand, len(users))); break
    print("   filter=%s -> HTTP %s 0 users" % (cand, code))
else:
    print("\n   NOTE: no filter variant matched; dumping top-level filterable keys via openapi once:")
    api("GET", "/api/users?fields=id,username&paging=false")  # learn accepted top keys
    sys.exit(1)
for u in users:
    ec = (u.get("userCredentials") or {})
    print("      id=%s username=%s name=%s %s" % (u.get("id"), ec.get("username"),
          u.get("firstName"), u.get("surname")))
assert not isinstance(r, dict) or "users" in r, ("unexpected:", str(r)[:200])

if len(users) == 1:
    user = users[0]
    uid = user["id"]
    print("\n== 2. set password (the page's route: userAccount/password with new=password) ==")
    code, body = api("POST", "/api/userAccount/password",
                     {"username": "lolleh", "oldPassword": "", "newPassword": "password"})
    print("   userAccount/password -> HTTP %d %s" % (code, str(body)[:120]))
    if str(code) not in ("200","201","204"):
        code, body = api("PUT", "/api/users/%s/changePassword" % uid,
                         {"newPassword": "password", "oldPassword": None})
        print("   fallback changePassword -> HTTP %d %s" % (code, str(body)[:120]))

print("\n== 3. VERIFY: log in AS lolleh:password right now ==")
code, body = api("GET", "/api/me", auth=base64.b64encode(b"lolleh:password").decode())
if code == 200:
    print("   LOGIN OK — lolleh:password works. username=%s" % (body or {}).get("username") if isinstance(body, dict) else str(body)[:100])
else:
    print("   LOGIN FAILED: HTTP %s %s" % (code, str(body)[:200]))
