#!/usr/bin/env python3
"""IDSR smoke round 2 — fully authoritative.
1) fetch mapping 8 from live bridge (authoritative concept uuids -> target DEs)
2) look up each concept_uuid -> concept_id in OpenMRS MySQL
3) seed 1 encounter (form_id 9, weekly W38 2026) + 4 numeric obs, one per concept
4) POST bridge /api/sync/run/8; poll /api/sync/logs/8
5) verify DHIS2 dataValueSets (ds/ou/2026W38) non-zero
No heredocs anywhere; everything via Write tool only.
"""
import json, base64, subprocess, sys, time, urllib.request, urllib.error, urllib.parse

FORM_UUID = "58c57d25-8d39-41ab-8422-108a0c277d98"
ET_UUID   = "1c0b7a25-8d39-41ab-8422-108a0c277d98"
LOC_UUID  = "19dada3a-b1b5-11f1-843b-720053b8a343"
DB_CNAME  = "dhis2-demo-server-openmrs-db-1"
BRIDGE_PORT = 4000
BRIDGE_AUTH = base64.b64encode(b"admin:district").decode()
ENC_UUID = "58 0c7a25-8d39-41ab-8422-108a0c277d98".replace(" ", "9")
ENC_DT  = "2026-09-15 10:30:00"

def mysql(q):
    r = subprocess.run(["docker","exec",DB_CNAME,"mysql","-uopenmrs","-pAdmin123","openmrs","-N","-B","-e",q],
                       capture_output=True, text=True, timeout=240)
    if r.returncode != 0:
        return "ERR:" + r.stderr.strip()[:300]
    return r.stdout.strip()

def api(port, path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request("http://localhost:%d%s" % (port, path), data=data, method=method,
        headers={"Content-Type":"application/json",
                 "Authorization":"Basic "+BRIDGE_AUTH})
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try: c = e.read().decode()[:500]
        except Exception: c = b""
        return {"__http": e.code, "__body": c}

print("== 1. mapping 8 live (authoritative) ==")
m = api(BRIDGE_PORT, "/api/mappings/8")
print("   id=%s name=%s direction=%s source_db=%s" %
      (m.get("id"), m.get("name"), m.get("direction"), m.get("source_db")))
print("   target ds=%s ou=%s period_type=%s period=%s" %
      (m.get("target_data_set"), m.get("target_org_unit"), m.get("period_type"), m.get("period")))
concepts = []
for em in (m.get("element_mappings") or m.get("mappings") or []):
    src = em.get("source_element") or em.get("source_concept") or em.get("concept_uuid")
    tgt = em.get("target_element") or em.get("target_de") or em.get("data_element")
    op  = em.get("transformation") or em.get("operator") or "count"
    concepts.append((src, tgt, op))
print("   element mappings: %d" % len(concepts))
for s,t,o in concepts:
    print("      %s -> %s  (%s)" % (str(s)[:12], t, o))

print("\n== 2. concept_uuid -> concept_id in OpenMRS MySQL (from mapping list only) ==")
uuid2cid = {}
for s,t,o in concepts:
    if not s: continue
    cid = mysql("select concept_id from concept where uuid='%s'" % s)
    uuid2cid[s] = cid
    print("   %s concept_id=%s" % (str(s)[:12], cid))

print("\n== 3. check current seed state (form 9 must exist, encounters/obs via that form) ==")
print("   form row:", mysql("select form_id, name from form where uuid='%s'" % FORM_UUID))
print("   patients:", mysql("select count(*) from patient"))
print("   et row  :", mysql("select encounter_type_id, name from encounter_type where uuid='%s'" % ET_UUID))
print("   encounters(form9):", mysql(
    "select count(*) from encounter e join form f on e.form_id=f.form_id where f.uuid='%s' and e.voided=0" % FORM_UUID))
print("   obs(form9):", mysql(
    "select count(*) from obs o join encounter e on o.encounter_id=e.encounter_id "
    "join form f on e.form_id=f.form_id where f.uuid='%s' and o.voided=0" % FORM_UUID))

pat_id = mysql("select patient_id from patient order by patient_id limit 1")
loc_id = mysql("select location_id from location where uuid='%s'" % LOC_UUID)
form_id = mysql("select form_id from form where uuid='%s'" % FORM_UUID)
et_id  = mysql("select encounter_type_id from encounter_type where uuid='%s'" % ET_UUID)
print("   pat_id=%s loc_id=%s form_id=%s et_id=%s" % (pat_id, loc_id, form_id, et_id))

print("\n== 4. seed ONE encounter + 4 numerical obs (2026-W38) ==")
if not form_id.isdigit() or not et_id.isdigit() or not pat_id.isdigit() or not loc_id.isdigit():
    print("   FAIL: missing prerequisite rows"); sys.exit(1)
enc_id = mysql("select max(encounter_id)+1 from encounter")
oid_base = int((mysql("select max(obs_id)+1 from obs") or 1))
enc_id = int(enc_id)
print("   encounter new id=%d at %s" % (enc_id, ENC_DT))
r = mysql(
    "insert into encounter (encounter_id, encounter_type, patient_id, location_id, "
    "form_id, encounter_datetime, creator, date_created, voided, uuid) "
    "values (%d,%s,%s,%s,%s,'%s',1,now(),0,'%s')"
    % (enc_id, et_id, pat_id, loc_id, form_id, ENC_DT, ENC_UUID))
print("   insert encounter rc:", "ok" if not r.startswith("ERR") else r)
got = mysql("select encounter_id from encounter where uuid='%s'" % ENC_UUID)
print("   confirmed encounter_id=%s" % got)

ok = 0
for i,(s,t,o) in enumerate(concepts):
    if not s: continue
    cid = uuid2cid[s]
    oid = oid_base + i
    ou = "58 0c7a25-8d39-41ab-8422-108a0c277d9%d" % (10+i)
    ou = ou.replace(" ", "1")
    val = 10 + i
    r = mysql(
        "insert into obs (obs_id, person_id, concept_id, encounter_id, obs_datetime, "
        "location_id, value_numeric, creator, date_created, voided, uuid) "
        "values (%d,%s,%s,%d,'%s',%s,%d,1,now(),0,'%s')"
        % (oid, pat_id, cid, enc_id, ENC_DT, loc_id, val, ou))
    print("   obs %d concept=%s val=%d rc=%s" % (oid, str(s)[:12], val, "ok" if not r.startswith("ERR") else r))
    if not r.startswith("ERR"): ok += 1
print("   obs inserted: %d/%d" % (ok, len(concepts)))
if ok == 0:
    print("   aborting: no obs seeded"); sys.exit(1)

print("\n== 5. run sync mapping 8 ==")
run = api(BRIDGE_PORT, "/api/sync/run/8", method="POST", body={})
print("   run:", json.dumps(run)[:300])

print("\n== 6. poll sync logs ==")
for _ in range(10):
    logs = api(BRIDGE_PORT, "/api/sync/logs/8")
    if isinstance(logs, list) and logs:
        last = logs[0]
        print("   status=%s error=%s" % (last.get("status"), str(last.get("error"))[:200]))
        if last.get("status") in ("success","complete","failed","error"):
            break
    time.sleep(5)
else:
    print("   no logs returned:", str(logs)[:200])

print("\n== 7. verify DHIS2 dataValueSets (non-zero) ==")
ds = m.get("target_data_set"); ou = m.get("target_org_unit")
for port in (8091, 8090, 8081, 8082, 8080):
    path = "/api/dataValueSets.json?dataSet=%s&orgUnit=%s&period=2026W38" % (ds, ou)
    d = api(port, path, body=None)
    if isinstance(d, dict) and "dataValues" in d:
        vals = d["dataValues"]
        print("   :%d -> %d dataValues" % (port, len(vals)))
        for v in vals[:8]:
            print("      %s/%s/%s = %s%s" % (v.get("dataElement"), v.get("period"), v.get("orgUnit"),
                                             v.get("value"), "  <-- NON-ZERO OK" if float(v.get("value") or 0) > 0 else ""))
        if any(float(v.get("value") or 0) > 0 for v in vals):
            print("   RESULT: SMOKE PASS (non-zero weekly IDSR values present)")
        else:
            print("   RESULT: dataValues returned but all zero")
        break
    elif isinstance(d, dict) and d.get("__http"):
        print("   :%d -> HTTP %s" % (port, d.get("__http")))
print("\ndone.")
