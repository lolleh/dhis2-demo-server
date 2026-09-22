#!/usr/bin/env python3
"""IDSr_SMOKE v4 — resolve every id from live DBs, not guesses. Fixes: (a) all 4 obs
with REAL concept_ids matched by display name in OpenMRS MySQL; (b) get DHIS2's own
dataValueSets import summary by replicating bridge's exact POST to see why 409."""
import base64, json, subprocess, sys, time, urllib.request, urllib.error

DB_C  = "dhis2-demo-server-openmrs-db-1"
AV    = base64.b64encode(b"admin:district").decode()
DHIS2 = "http://127.0.0.1:8091"
BR    = "http://127.0.0.1:4000"
FORM_UUID  = "58c57d25-8d39-41ab-8422-108a0c277d98"
ENC_UUID   = "58c57d25-8d39-41bb-8422-108a0c277d98"
LOC_UUID   = "19dada3a-b1b5-11f1-843b-720053b8a343"
ENC_DT     = "2026-09-15 10:30:00"
WEEK_PERIOD= "2026W38"
TARGET_DS, TARGET_OU = "y77LiPqLMoq", "IDZUW0zA8F7"

def mysql(q):
    r = subprocess.run(["docker","exec",DB_C,"mysql","-uopenmrs","-pAdmin123","openmrs","-N","-B","-e",q],
                       capture_output=True, text=True, timeout=120)
    return r.stdout.strip() if r.returncode==0 else "ERR:NEED_FALLBACK_TRY_PASSWORD"

def http(url, path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url+path, data=data, method=method,
        headers={"Content-Type":"application/json","Authorization":"Basic "+AV})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"").decode()[:900]
        try: return {"__http":e.code, "__body": json.loads(raw)}
        except Exception: return {"__http":e.code, "__body": raw}
    except Exception as e:
        return {"__net": str(e)[:200]}

print("== fallback: if password wrong, retry with the OTHER reported password ==")
r1 = mysql("select 1")
if r1.startswith("ERR"):
    def mysql2(q):  # alternate credential (Admin123 uppercase scheme as seen in bridge .env)
        r = subprocess.run(["docker","exec",DB_C,"mysql","-uopenmrs","-pAdmin123","openmrs","-N","-B","-e",q],
                           capture_output=True, text=True, timeout=120)
        return r.stdout.strip() if r.returncode==0 else "ERR:"+r.stderr.strip()[:200]
    print("   Admin123 pwd ->", "OK" if mysql2("select 1")=="1" else mysql2("select 1")[:100])
    print("   retry our default pwd ->", "OK" if mysql("select 1")=="1" else "still ERR")
    if mysql("select 1")!="1" and mysql2("select 1")=="1":
        print("   NOTE: live password is Admin123 (uppercase A). Will switch mysql() to it.")
        import re; _m = mysql
        def mysql(q):
    r = subprocess.run(["docker","exec",DB_C,"mysql","-uopenmrs","-pAdmin123","openmrs","-N","-B","-e",q],
                       capture_output=True, timeout=120)
    out = r.stdout.decode("utf-8","replace") if r.stdout else ""
    return out.strip() if r.returncode==0 else "ERR:"+r.stderr.decode("utf-8","replace")[:300]
else:
    print("   current password works.")

print("\n== FULL authorit: live mapping 8 element mappings ==")
m = http(BR, "/api/mappings/8")
for e in m.get("element_mappings", []):
    print("   src=%s tgt=%s xform=%s" % (e.get("source_element"), e.get("target_element"), e.get("transformation")))

print("\n== 1. REAL concept ids by display-name match (OpenMRS MySQL, voided=0) ==")
names = ["Total consultations", "Malaria", "Diarrhoea", "ARI", "Pneumonia"]
rows = mysql(
    "select c.concept_id, cn.name, c.uuid from concept c "
    "join concept_name cn on cn.concept_id=c.concept_id and cn.voided=0 "
    "where cn.name like '%consultation%' or cn.name like '%malaria%' or "
    "cn.name like '%diarrhoea%' or cn.name like '%pneumonia%' or cn.name like '%ARI%' "
    "order by c.concept_id")
for ln in rows.splitlines():
    print("   "+ln)
