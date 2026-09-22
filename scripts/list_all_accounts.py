#!/usr/bin/env python3
"""ONE query, two authoritative stores: list EVERY username/account that actually exists.
No filters, no guessing — the full truth. Never echoes any credential."""
import base64, json, subprocess, sys, urllib.request, urllib.error

AUTH = base64.b64encode(b"admin:district").decode()

def dhis_api(path):
    req = urllib.request.Request("http://127.0.0.1:8091"+path,
        headers={"Authorization": "Basic "+AUTH, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read().decode("utf-8","replace"))
    except urllib.error.HTTPError as e:
        return {"__http": e.code, "__body": (e.read() or b"").decode("utf-8","replace")[:300]}
    except Exception as e:
        return {"__net": str(e)[:150]}

print("== 1. DHIS2 — EVERY user account in this instance (full list, exact usernames) ==")
d = dhis_api("/api/users?fields=id,userCredentials[username,disabled],firstName,surname,userRoles[id,name]&paging=false")
users = d.get("users", []) if isinstance(d, dict) else []
print("   total users: %d" % len(users))
for u in sorted(users, key=lambda x: (x.get("userCredentials") or {}).get("username") or ""):
    uc = u.get("userCredentials") or {}
    roles = "|".join(r.get("name","") for r in u.get("userRoles", []))[:40]
    print("   %-32s id=%s  disabled=%s  roles=%s" % (uc.get("username"), u.get("id"), uc.get("disabled"), roles))
if not users:
    print("   (dict keys: %s)" % (list(d.keys()) if isinstance(d, dict) else type(d).__name__))

print("\n== 2. OpenMRS — EVERY non-voided user/person (MySQL, authoritative) ==")
def mysql(q):
    r = subprocess.run(["docker","exec","dhis2-demo-server-openmrs-db-1","mysql","-uopenmrs","-pAdmin123",
                        "openmrs","-N","-B","-e",q], capture_output=True, timeout=180)
    return (r.stdout or b"").decode("utf-8","replace").strip() if r.returncode==0 else "ERR:"+r.stderr.decode("utf-8","replace")[:300]
out = mysql("select u.user_id, system_id, concat(p.given_name,' ',p.family_name) as nm, u.retired "
            "from users u join person p on p.person_id=u.person_id where p.voided=0")
print("   " + "\n   ".join(("row: "+ln) for ln in out.splitlines()) if out else "   (none)")

print("\n== 3. does ENY exact-name account exist in either? (Jake/Jule/Johnh/Jane Smith, lolleh) — zero-guess ==")
for target in ("lolleh",):
    hit = [u for u in users if (u.get("userCredentials") or {}).get("username","").lower()==target]
    print("   username '%s' in DHIS2: %s" % (target, hit[0]["id"] if hit else "NOT PRESENT"))
for target in ("Jake","Julie","Johnh","Jane"):
    hm = mysql("select 1 from person where voided=0 and given_name='%s'" % target)
    print("   given_name '%s' in OpenMRS: %s" % (target, "present" if hm=="1" else "NOT PRESENT"))
