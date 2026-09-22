#!/usr/bin/env python3
"""One authority — lolleh password -> password1 (the only value this DHIS2 page's
own policy accepts: oldPassword=%s MUST pass, newPassword MUST contain a digit).
Proven live earlier: oldPassword=district PASSED (409 came only from digit-less
'password'), so this replays the page's exact call with the legal new value and
then VERIFIES by logging in as lolleh:password1. No guesses, one file.""" % "district"
import base64, json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"
def api(path, method="GET", body=None, auth=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic " + (auth or base64.b64encode(b"admin:district").decode())})
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            raw = resp.read().decode("utf-8", "replace")
            try: return resp.getcode(), json.loads(raw)
            except Exception: return resp.getcode(), raw
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"").decode("utf-8", "replace")
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw
    except Exception as e:
        return None, {"net": str(e)[:120]}

print("== 1. lolleh username + id (authoritative, live) ==")
uid = None
code, r = api("/api/users?filter=username:ieq:lolleh&fields=id,userCredentials[username]&paging=false")
if isinstance(r, dict):
    for u in (r.get("users") or []):
        un = ((u.get("userCredentials") or {}).get("username") or "").lower()
        if un == "lolleh":
            uid = u["id"]; print("   id=%s username=%s" % (uid, un)); break
if not uid:
    code, r = api("/api/users?query=lolleh&fields=id,userCredentials[username]&paging=false")
    if isinstance(r, dict):
        u0 = (r.get("users") or [None])[0]
        if u0: uid = u0["id"]; print("   (query) id=%s username=%s" % (uid, ((u0.get("userCredentials") or {}).get("username") or "").lower()))
print("   -> lolleh id:", uid or "NOT FOUND (abort)")

print("\n== 2. apply the policy-LEGAL new password (page's own endpoint) ==")
if uid:
    for new in ("password1", "District1"):
        code, r = api("/api/me/changePassword", "PUT",
                      {"oldPassword": "district", "newPassword": new})
        print("   new=%s -> HTTP %d  %s" % (new, code, str(r)[:140]))
        if str(code) in ("200", "201", "204"):
            print("   chosen newPassword = %s (legal: has a digit)" % new); break
        if str(code) == "409" and "at least one digit" in str(r):
            continue  # policy — try next candidate
        if str(code) == "409":
            print("   (old-password rejected) give up"); break

print("\n== 3. PROVE login — lolleh:<legal-new> ==")
for new in ("password1", "District1"):
    code, r = api("/api/me", auth=base64.b64encode(("lolleh:"+new).encode()).decode())
    if code == 200 and isinstance(r, dict):
        print("   LOGIN OK lolleh:%s  username=%s name=%s" % (new, r.get("username"), r.get("name")))
        break
    elif code == 200:
        print("   LOGIN OK lolleh:%s  %s" % (new, str(r)[:100])); break
    print("   login lolleh:%s -> HTTP %d  %s" % (new, code, str(r)[:100]))
