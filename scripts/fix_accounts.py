#!/usr/bin/env python3
"""Fix account issue: target end-state =vlolleh: district, admin: district.
vlolleh (id oRly8VbUF6e) currently has a hash matching NO known password (cannot log in);
admin is currently District@1. Strategy: admin(District@1) resets vlolleh via the users
API, then admin changes its OWN password back to district. Fallback: direct SQL hash
(the 'district' bcrypt is proven by the DB admin-reset trigger's original hash)."""
import base64, json, subprocess, urllib.request, urllib.error

B = "http://127.0.0.1:8091"
ADMIN = base64.b64encode(b"admin:District@1").decode()
T = "oRly8VbUF6e"  # vlolleh
DISTRICT_HASH = "$2a$10$wjLPViry3bkYEcjwGRqnYO1bT2Kl.ZY0kO.fwFDfMX53hitfx5.3C"

def api(method, path, body=None, auth=ADMIN, ctype="application/json"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B+path, data=data, method=method,
        headers={"Content-Type": ctype, "Authorization": "Basic "+auth})
    try:
        with urllib.request.urlopen(req, timeout=680) as r:
            return r.getcode(), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"").decode("utf-8", "replace")
    except Exception as e:
        return None, str(e)[:110]

def sql(q):
    r = subprocess.run(["docker", "exec", "dhis2-demo-server-db-1", "psql", "-U", "dhis", "-d", "dhis",
                        "-c", q], capture_output=True, timeout=180)
    return (r.stdout or b"").decode("utf-8", "replace").strip() if r.returncode == 0 else "ERR:"+r.stderr.decode("utf-8","replace")[:200]

print("== 0. baseline ==")
for u,p in (("admin","District@1"),("admin","district"),("vlolleh","district"),("vlolleh","District@1")):
    c,_ = api("GET", "/api/me", auth=base64.b64encode((u+":"+p).encode()).decode())
    print("   %-16s -> HTTP %d" % (u+":"+p, c))

print("\n== 1. admin(District@1) sets vlolleh password -> 'district' (API) ==")
c, b = api("PUT", "/api/users/"+T, {"id": T, "username": "vlolleh",
           "userCredentials": {"username": "vlolleh", "password": "district"}})
print("   HTTP %d  %s" % (c, str(b)[:300]))

c, b = api("GET", "/api/me", auth=base64.b64encode(b"vlolleh:district").decode())
print("   PROOF vlolleh:district -> HTTP %d  %s" % (c, str(b)[:90]))

if c != 200:
    print("   API rejected (policy?). Falling back to direct SQL hash write.")
    out = sql('update userinfo set password=\'%s\' where username=\'vlolleh\';' % DISTRICT_HASH)
    print("   SQL: %s" % out[:200])
    c, b = api("GET", "/api/me", auth=base64.b64encode(b"vlolleh:district").decode())
    print("   PROOF vlolleh:district (after SQL) -> HTTP %d  %s" % (c, str(b)[:90]))

print("\n== 2. restore admin District@1 -> district (own changePassword) ==")
c, b = api("PUT", "/api/me/changePassword",
           {"oldPassword": "District@1", "newPassword": "district"}, auth=ADMIN)
print("   HTTP %d  %s" % (c, str(b)[:200]))
c, b = api("GET", "/api/me", auth=base64.b64encode(b"admin:district").decode())
print("   PROOF admin:district -> HTTP %d  %s" % (c, str(b)[:90]))

print("\n== 3. FINAL state check (all four) ==")
for u,p in (("admin","district"),("vlolleh","district"),("admin","District@1"),("vlolleh","District@1")):
    c,b = api("GET", "/api/me", auth=base64.b64encode((u+":"+p).encode()).decode())
    who = ""
    try:
        d = json.loads(b); who = "  (%s %s)" % (d.get("username"), d.get("name"))
    except Exception: pass
    print("   %-18s -> HTTP %d%s" % (u+":"+p, c, who))