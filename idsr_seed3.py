#!/usr/bin/env python3
"""IDSR seed (real ids) + bridge sync/8 + DHIS2(8091) verify. No guesses; every id is SELECTed live."""
import base64, json, subprocess, sys, time, urllib.request, urllib.error

DHIS2  = "http://127.0.0.1:8091"
BRIDGE = "http://127.0.0.1:4000"
AUTH   = base64.b64encode(b"admin:district").decode()
DB_C   = "dhis2-demo-server-openmrs-db-1"
FORM_UUID = "58c57d25-8d39-41ab-8422-108a0c277d98"
ENC_UUID  = "58c57d25-8d39-41bb-8422-108a0c277d98"
LOC_UUID  = "19dada3a-b1b5-11f1-843b-720053b8a343"
# mapping-8 element mappings: (concept_uuid, target_DE) — from live mapping 8
MAPPED = [
    ("6b1b7255-4bdf-4c9d-b411-314de1c11f9a", "vq2qO3eTrNi"),  # Total consultations
    ("5abb022f-406a-4ee6-a223-abf11a944ca1", "ekJQ3Ek3Rfg"),  # Malaria confirmed
    ("8170cef7-592d-4f3e-85b2-adc96c94b2",   "tnrawl1n9fk"),  # Diarrhoea
    ("ada12301-be11-4a63-9eb5-2a9d9b6e18de", "vq2qO3eTrNi"),  # ARI/pneumonia
]
WEEKLY_VALUES = [47, 12, 9, 8]
PATIENT_REAL  = None

def mysql(q):
    r = subprocess.run(["docker","exec",DB_C,"mysql","-uopenmrs","-pAdmin123","openmrs","-N","-B","-e",q],
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        return "ERR:" + r.stderr.strip()[:300]
    return r.stdout.strip()

def http(base, path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base+path, data=data, method=method,
        headers={"Content-Type":"application/json","Authorization":"Basic "+AUTH})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"__http": e.code, "__body": (e.read() or b"").decode()[:400]}

print("== 1. real ids from MySQL (live) ==")
pat = mysql("select p.patient_id from patient p join person pe on p.patient_id=pe.person_id "
            "where p.voided=0 and pe.voided=0 order by p.patient_id limit 1")
print("   real patient_id:", pat or "(none!)")
loc = mysql("select location_id from location where uuid='%s'" % LOC_UUID)
print("   location_id (Mongo Bendugu CHC):", loc)
form = mysql("select form_id from form where uuid='%s'" % FORM_UUID)
print("   form_id (from uuid):", form)
et = mysql("select encounter_type_id from encounter_type where name='IDSR Weekly eIDSR' or uuid like '58c57d25-8d39-41ab-8422-108a0c277d98'")
print("   encounter_type_id (IDSR Weekly):", et)

concept_ids = []
print("\n== 2. concept_uuid -> concept_id (live) ==")
for cu, de in MAPPED:
    cid = mysql("select concept_id from concept where uuid='%s'" % cu)
    print("   %s -> id=%s  DE=%s" % (cu[:12], cid or "(missing!)", de))
    concept_ids.append((cid, de))

if not pat or not loc or not form or not et:
    print("\n   ABORT: missing prerequisite (patient=%s loc=%s form=%s et=%s)" % (pat,loc,form,et))
    sys.exit(1)

print("\n== 3. seed encounter (real patient, form+et+loc, week of 2026-W38) ==")
enc_dt = "2026-09-15 10:30:00"
en = mysql("select encounter_id from encounter where uuid='%s'" % ENC_UUID)
if en:
    print("   encounter exists:", en)
    ENC = en
else:
    nid = mysql("select max(encounter_id)+1 from encounter")
    fid, etid, pt, li = form, et, pat, loc
    r = mysql(
        "insert into encounter (encounter_id, encounter_type, patient_id, location_id, form_id, "
        "encounter_datetime, creator, date_created, voided, uuid) "
        "values (%s,%s,%s,%s,%s,'%s',1,now(),0,'%s')" % (nid, etid, pt, li, fid, enc_dt, ENC_UUID))
    if r.startswith("ERR"):
        print("   insert FAILED:", r); sys.exit(1)
    ENC = nid
print("   encounter_id:", ENC)

print("\n== 4. seed 4 obs (numeric) ==")
obs_base = mysql("select max(obs_id)+1 from obs")
person_id = mysql("select person_id from person where person_id=%s" % pat)
ok = 0
for i, (cid, de) in enumerate(concept_ids):
    if not cid:
        print("   skip concept missing cid")
        continue
    ouuid = "58c57d25-8d39-41bb-8422-108a0c277d9%d" % (1+i)
    if mysql("select obs_id from obs where uuid='%s'" % ouuid):
        print("   obs %d exists" % (i+1)); ok += 1; continue
    oid = int(obs_base) + i
    val = WEEKLY_VALUES[i]
    r = mysql(
        "insert into obs (obs_id, person_id, concept_id, encounter_id, obs_datetime, "
        "location_id, value_numeric, creator, date_created, voided, uuid) values "
        "(%d,%s,%s,%s,'%s',%s,%d,1,now(),0,'%s')" % (oid, person_id, cid, ENC, enc_dt, loc, val, ouuid))
    if r.startswith("ERR"):
        print("   obs %d FAILED: %s" % (i+1, r))
    else:
        ok += 1
        print("   obs %d ok: concept=%s value=%d" % (i+1, cid, val))
print("   obs seeded: %d/%d" % (ok, len(concept_ids)))

print("\n== 5. verify what bridge's SQL will read (the exact 4 DEs' counts) ==")
print("  ", mysql(
    "select c.uuid, count(case when o.value_numeric>0 then 1 end) "
    "from obs o join encounter e on o.encounter_id=e.encounter_id "
    "join concept c on o.concept_id=c.concept_id "
    "where e.voided=0 and o.voided=0 and c.uuid in ('%s') "
    "and e.encounter_datetime between '2026-09-14' and '2026-09-20' "
    "group by c.uuid" % "','".join(u for u,_ in MAPPED)).replace("\n","\n   "))

print("\n== 6. run bridge sync mapping 8 ==")
print("   ", http(BRIDGE, "/api/mappings/8"))
print("   POST /api/sync/run/8 ->", json.dumps(http(BRIDGE, "/api/sync/run/8", "POST", {}))[:300])
time.sleep(10)
print("   logs:", json.dumps(http(BRIDGE, "/api/sync/logs/8"))[:600])

print("\n== 7. DHIS2 8091: weekly dataValueSets (2026W38) — count + sample ==")
ds, ou = "y77LiPqLMoq", "IDZUW0zA8F7"
for path in ("/api/dataValueSets.json?dataSet=%s&orgUnit=%s&period=2026W38" % (ds,ou),
             "/api/dataValueSets?dataSet=%s&orgUnit=%s&period=2026W38" % (ds,ou)):
    d = http(DHIS2, path)
    if isinstance(d, dict) and "dataValues" in d:
        vv = [x for x in d["dataValues"] if x.get("value")]
        print("   %d dataValues (non-zero: %d)" % (len(d["dataValues"]), len(vv)))
        for x in vv[:8]:
            print("      %s = %s" % (x.get("dataElement"), x.get("value")))
        print("   RESULT: %s" % ("SMOKE PASS (weekly non-zero present)" if vv else "STILL ZERO"))
        break
    else:
        print("   path failed:", json.dumps(d)[:200])
