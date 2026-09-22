#!/usr/bin/env python3
"""IDSR seed part 2 — fix the one gap (encounter_type), seed encounter+4 obs, run sync 8, verify DHIS2."""
import base64, json, subprocess, time, urllib.request, urllib.error

DB = "dhis2-demo-server-openmrs-db-1"
FORM_UUID = "58c57d25-8d39-41ab-8422-108a0c277d98"   # mapping-8 source_data_set (form uuid)
LOC_UUID  = "19dada3a-b1b5-11f1-843b-720053b8a343"   # Mongo Bendugu CHC
ENC_UUID  = "58c57d25-8d39-41ab-8422-208a0c277d98"
PATIENT_ID = 1

CONCEPTS = [  # (concept_uuid from mapping-8, concept_id, DE, weekly value)
    ("6b1b7255-4bdf-4c9d-b411-314de1c11f9a", 165175, "vq2qO3eTrNi", 47),
    ("5abb022f-406a-4ee6-a223-abf11a944ca1", 165192, "ekJQ3Ek3Rfg", 12),
    ("8170cef7-592d-4f3e-85b2-adc96c94b2",   165254, "tnrawl1n9fk",  9),
    ("ada12301-be11-4a63-9eb5-2a9d9b6e18de", 165180, "vq2qO3eTrNi",  8),
]

def mysql(q):
    r = subprocess.run(["docker","exec",DB,"mysql","-uopenmrs","-pAdmin123","openmrs","-N","-B","-e",q],
                       capture_output=True, text=True, timeout=120)
    return r.stdout.strip() if r.returncode == 0 else "ERR:"+r.stderr.strip()[:400]

def bridge(port, path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request("http://localhost:%d%s" % (port,path), data=data, method=method,
        headers={"Content-Type":"application/json","Authorization":"Basic "+base64.b64encode(b"admin:district").decode()})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"__http":e.code, "__body":e.read().decode()[:300]}

print("== 1. real encounter_type rows (openmrs) ==")
rows = mysql("select encounter_type_id,name,uuid from encounter_type where retired=0")
for ln in rows.splitlines()[:10]:
    print("   ", ln)

print("\n== 2. seed encounter via form_id (use an existing encounter_type_id) ==")
et_id = mysql("select min(encounter_type_id) from encounter_type where retired=0")
form_id = mysql("select form_id from form where uuid='%s'" % FORM_UUID)
loc_id  = mysql("select location_id from location where uuid='%s'" % LOC_UUID)
fid = mysql("select encounter_id from encounter where uuid='%s'" % ENC_UUID)
print("   et_id=%s form_id=%s loc_id=%s existing_enc=%s" % (et_id, form_id, loc_id, fid or "(none)"))
if not fid:
    en_id = mysql("select max(encounter_id)+1 from encounter")
    enc_dt = "2026-09-15 10:30:00"
    r = mysql(
        "insert into encounter (encounter_id, encounter_type, patient_id, location_id, form_id, "
        "encounter_datetime, creator, date_created, voided, uuid) "
        "values (%s,%s,%s,%s,%s,'%s',1,now(),0,'%s')" %
        (en_id, et_id, PATIENT_ID, loc_id, form_id, enc_dt, ENC_UUID))
    print("   insert:", "ok" if not r.startswith("ERR") else r)
else:
    en_id = fid
    print("   reuse enc_id=%s" % en_id)

print("\n== 3. seed 4 obs (value_numeric, form-linked) ==")
oid = mysql("select max(obs_id)+1 from obs")
ok = 0
obs_uuids = ["1c0b7a25-8d39-41ab-8422-108a0c277d9%d" % (10+i) for i in range(1,5)]
for i,(cuuid,cid,de,val) in enumerate(CONCEPTS):
    ou = obs_uuids[i]
    if mysql("select obs_id from obs where uuid='%s'" % ou):
        print("   obs %d already exists" % (i+1)); ok += 1; continue
    r = mysql(
        "insert into obs (obs_id, person_id, concept_id, encounter_id, obs_datetime, location_id, "
        "value_numeric, creator, date_created, voided, uuid) "
        "values (%d,%s,%s,%s,'2026-09-15 10:30:00',%s,%d,1,now(),0,'%s')" %
        (int(oid)+i, PATIENT_ID, cid, en_id, loc_id, val, ou))
    if not r.startswith("ERR"):
        ok += 1
    else:
        print("   obs %d FAIL: %s" % (i+1, r))
print("   obs inserted: %d/4" % ok)

print("\n== 4. verify readiness via the SAME sql shape bridge uses ==")
print("  ", mysql(
    "select e.encounter_id, f.uuid, o.uuid, c.uuid, o.value_numeric "
    "from encounter e join form f on e.form_id=f.form_id "
    "join obs o on o.encounter_id=e.encounter_id "
    "join concept c on o.concept_id=c.concept_id "
    "where f.uuid='%s' and o.voided=0" % FORM_UUID).replace("\n","\n   "))

print("\n== 5. run sync, poll logs ==")
for p in (4000, 9000):
    if p == 4000:
        pass
r = bridge(4000, "/api/sync/run/8", "POST", {})
print("   sync/run/8:", json.dumps(r)[:300])
for i in range(6):
    logs = bridge(4000, "/api/sync/logs/8")
    if isinstance(logs, list) and logs:
        last = logs[0]
        print("   log: status=%s error=%s" % (last.get("status"), str(last.get("error"))[:160]))
        if last.get("status") in ("success","completed","failed","error"):
            break
    time.sleep(8)

print("\n== 6. DHIS2 dataValueSets (weekly) — expect non-zero ==")
ds = "y77LiPqLMoq"; ou = "IDZUW0zA8F7"
for port in (8081, 8082, 8090, 8091, 9091, 8888):
    d = bridge(port, "/api/dataValueSets.json?dataSet=%s&orgUnit=%s&period=2026W38" % (ds, ou))
    if isinstance(d, dict) and "dataValues" in d:
        vals = d["dataValues"]
        print("   :%d -> %d dataValues" % (port, len(vals)))
        for v in vals[:6]:
            print("      %s = %s" % (v.get("dataElement"), v.get("value")))
        break
    elif isinstance(d, dict) and d.get("__http"):
        pass
