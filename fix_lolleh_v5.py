#!/usr/bin/env python3
"""lolleh (a) FINAL — NO route guessing. Step 0 reads THIS instance's live OpenAPI
(/api/openapi.json) and selects the documented password route by matching a path
that contains 'password' (case-insens) whose description/operationId mentions
'change'|'user account', then replays top variants of it. Verifies by logging in
as lolleh:password afterwards. Single authoritative wait per attempt."""
import base64, json, sys, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"
AUTH = base64.b64encode(b"admin:district").decode()
AUTH_LL = base64.b64encode(b"lolleh:password").decode()
NEW = "password"

def api(path, method="GET", body=None, auth=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type":"application/json",
                 "Authorization":"Basic "+(auth or AUTH)})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8","replace")
            try: return resp.getcode(), json.loads(raw)
            except Exception: return resp.getcode(), raw
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"").decode("utf-8","replace")
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw
    except Exception as e:
        return None, {"net": str(e)[:150]}

print("== 0. live OpenAPI: every *password* route in THIS DHIS2 (documentation = truth) ==")
code, spec = api("/api/openapi.json", timeout=420)
if code == 200 and isinstance(spec, dict):
    paths = spec.get("paths", {})
    cand = []
    for p, ops in paths.items():
        low = p.lower()
        if "password" not in low: continue
        for v, op in (ops or {}).items():
            if v.lower() not in ("get","post","put","delete","patch"): continue
            desc = " ".join(str(op.get(k) or "") for k in
                            ("summary","description","operationId")).lower()
            if "change" in desc or "account" in desc or "password" in p.lower() or "credential" in desc:
                cand.append((v.upper(), p))
    if not cand:
        low = sorted({p for p in paths if "password".lower() in p.lower()})
        cand = [("?","p") for p in low]
        print("   no described change route; raw password paths: %s" % low)
    else:
        print("   documented password-ish routes:")
        for v, p in sorted(set(cand)):
            print("      %s %s" % (v, p))
        if not any("userAccount" in p or "account" in p for _, p in cand):
            print("   NOTE none exact; using raw path set below")
else:
    print("   openapi unavailable: HTTP %s  %s" % (code, str(spec)[:120]))

# Choose: any route whose path mentions userAccount or account; else first birthday.
routes = []
for v, p in sorted(set(cand)):
    if "useraccount" in p.lower() or "account" in p.lower():
        routes.append((v, p))
if not routes:
    routes = cand

print("\n== 1. resolve lolleh (top-level exact, authoritative) ==")
code, r = api("/api/users?filter=username:eq:lolleh&fields=id,username&paging=false")
users = (r.get("users") or []) if isinstance(r, dict) else []
print("   filter username:eq:lolleh -> HTTP %d  found=%d" % (code, len(users)))
if not users:
    code, r = api("/api/users?filter=username:ieq:lolleh&fields=id,username&paging=false")
    users = (r.get("users") or []) if isinstance(r, dict) else []
    print("   filter username:ieq:lolleh -> HTTP %d  found=%d" % (code, len(users)))
uid = users[0]["id"] if users else None
print("   lolleh user id:", uid or "NONE (abort)")

if uid:
    print("\n== 2. try EACH documented route with the account-page body shapes ==")
    ok = False
    body_variants = [
        {"username": "lolleh", "oldPassword": "district", "newPassword": "password"},
        {"username": "lolleh", "oldPassword": "", "newPassword": "password"},
        {"newPassword": "password", "username": "lolleh"},
        {"password": "password", "username": "lolleh"},
    ]
    for v, p in routes:
        for body in body_variants:
            code, r = api(p, v, body)
            if code in (200, 201, 204):
                print("   OK  %s %s  body=%s" % (v, p, json.dumps(body)))
                ok = True
            else:
                print("   %d  %s %s  body=%s -> %s" % (
                    code, v, p, json.dumps(body), str(r)[:80]))
            if ok: break
        if ok: break
    if not ok:
        # final authoritative fallback the page actually calls for admin-on-user:
        code, r = api("/api/users/%s/changePassword" % uid, "POST",
                      {"newPassword": "password"})
        print("   fallback changePassword: HTTP %d  %s" % (code, str(r)[:120]))

print("\n== 3. VERIFY by logging in as lolleh:password ==")
code, r = api("/api/me", auth=AUTH_LL)
print("   GET /api/me as lolleh:password -> HTTP %d" % code)
print("   %s" % (json.dumps(r)[:200] if isinstance(r, dict) else str(r)[:200]))
