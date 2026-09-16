#!/usr/bin/env python3
"""Push the Under Five Register mockup into the OpenMRS demo instance.

Concepts / encounter type / form are created via the OpenMRS REST API
(concept, encountertype and form POSTs work; patient and encounter POSTs are
broken by a RESTWS converter bug in this image, so patients and encounters are
inserted directly into MySQL, mirroring how the demo's Above Five data was
planted).

Run from the repo root:
    python3 mockups/push_under_five.py
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(ROOT, "mockups", "under-five-register-model.json")
DATA_PATH = os.path.join(ROOT, "mockups", "under-five-register-mock-data.json")

BASE = "http://localhost:8090/openmrs/ws/rest/v1"
AUTH = "Basic " + base64.b64encode(b"admin:Admin123").decode()
MYSQL = ["docker", "exec", "-i", "dhis2-demo-server-openmrs-db-1",
         "mysql", "-uopenmrs", "-pAdmin123", "openmrs"]


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", AUTH)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        sys.stderr.write(f"HTTP {e.code} {method} {path}: {raw[:500]}\n")
        raise


def mysql_run(sql):
    p = subprocess.run(MYSQL, input=sql, capture_output=True, text=True)
    if p.returncode != 0:
        sys.stderr.write(f"mysql error: {p.stderr}\n{sql[:800]}\n")
        raise SystemExit(1)
    return p.stdout


def find_concept_uuid(name):
    _, d = api("GET", "/concept?q=" + urllib.parse.quote(name) + "&limit=100")
    for c in (d or {}).get("results", []):
        if c.get("display") == name and urllib.parse.unquote(name) == c.get("display"):
            return c["uuid"]
        if c.get("display") == name:
            return c["uuid"]
    return None


def create_concept(name, datatype, concept_class):
    body = {
        "names": [{"name": name, "locale": "en", "localePreferred": True}],
        "datatype": datatype,
        "conceptClass": concept_class,
    }
    try:
        _, d = api("POST", "/concept", body)
        return d["uuid"]
    except urllib.error.HTTPError as e:
        if e.code != 500:
            raise
        # likely a duplicate fully-specified name (incl. retired concepts that
        # are hidden from REST search) -> reuse the existing concept
        out = mysql_run(
            "SELECT c.uuid FROM concept c JOIN concept_name cn "
            "ON cn.concept_id=c.concept_id "
            f"WHERE cn.name='{name}' "
            "AND cn.voided=0 AND cn.concept_name_type='FULLY_SPECIFIED' "
            "AND c.retired=0 LIMIT 1;")
        lines = [l for l in out.strip().splitlines() if l and not l.startswith("Warning")]
        if len(lines) >= 2:
            sys.stderr.write(f"  note: '{name}' already exists as FULLY_SPECIFIED "
                             f"({lines[1]}), reusing\n")
            return lines[1]
        out = mysql_run(
            "SELECT c.uuid FROM concept c JOIN concept_name cn "
            "ON cn.concept_id=c.concept_id "
            f"WHERE cn.name='{name}' "
            "AND cn.voided=0 AND c.retired=1 LIMIT 1;")
        lines = [l for l in out.strip().splitlines() if l and not l.startswith("Warning")]
        if len(lines) >= 2:
            sys.stderr.write(f"  note: '{name}' exists as a retired concept "
                             f"({lines[1]}), reusing\n")
            return lines[1]
        raise


def load_model():
    model = json.load(open(MODEL_PATH, encoding="utf-8"))
    data = json.load(open(DATA_PATH, encoding="utf-8"))
    return model, data


def main():
    model, data = load_model()
    concepts = model["concepts"]
    reused = concepts["reused"]
    new_answers = concepts["answers"]
    questions = concepts["questions"]

    print("== concepts ==")
    qid = {}   # answer name -> uuid
    for name, u in reused.items():
        qid[name] = u
        print(f"  reuse {name} -> {u}")

    created = {}
    for name in new_answers:
        u = find_concept_uuid(name)
        if u:
            qid[name] = u
            print(f"  exist {name} -> {u}")
        else:
            u = create_concept(name, "Coded", "Misc")
            qid[name] = u
            created[name] = u
            print(f"  made  {name} -> {u}")

    cqids = {}  # question name -> uuid
    for q in questions:
        name, datatype, answers = q["name"], q["datatype"], q["answers"]
        u = find_concept_uuid(name)
        if u:
            cqids[name] = u
            print(f"  exist Q {name} ({datatype}) -> {u}")
        else:
            u = create_concept(name, datatype, "Question")
            cqids[name] = u
            created[name] = u
            print(f"  made  Q {name} ({datatype}) -> {u}")

    print(f"\ncreated {len(created)} concepts; total questions usable: {len(cqids)}")

    assert len(cqids) == len(questions), "question concept count mismatch"

    print("\n== encounter type + form ==")
    et_spec = model["encounter_type"]
    et_uuid = None
    _, d = api("GET", "/encountertype?q=" + urllib.parse.quote(et_spec["name"]) + "&limit=100")
    for e in (d or {}).get("results", []):
        if e.get("display") == et_spec["name"]:
            et_uuid = e["uuid"]
            break
    if not et_uuid:
        _, d = api("POST", "/encountertype", et_spec)
        et_uuid = d["uuid"]
    print(f"  encounter type {et_spec['name']} -> {et_uuid}")

    form_spec = model["form"]
    form_uuid = None
    _, d = api("GET", "/form?q=" + urllib.parse.quote(form_spec["name"]) + "&limit=100")
    for f in (d or {}).get("results", []):
        if f.get("display") == form_spec["name"]:
            form_uuid = f["uuid"]
            break
    if not form_uuid:
        body = {"name": form_spec["name"], "version": form_spec["version"],
                "encounterType": {"uuid": et_uuid}, "retired": False}
        _, d = api("POST", "/form", body)
        form_uuid = d["uuid"]
    print(f"  form {form_spec['name']} -> {form_uuid}")

    # resolve integer ids for the DB inserts
    all_uuids = set(cqids.values()) | set(qid.values()) | {et_uuid, form_uuid}
    out = mysql_run(
        "SELECT concept_id, uuid FROM concept WHERE uuid IN (" +
        ",".join(f"'{u}'" for u in all_uuids if u) + ");"
    )
    cid_by_uuid = {}
    for line in out.strip().splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) == 2:
            cid_by_uuid[parts[1]] = int(parts[0])
    et_id = int(mysql_run(
        "SELECT encounter_type_id FROM encounter_type WHERE uuid='%s';" % et_uuid
    ).strip().splitlines()[-1])
    form_id = int(mysql_run(
        "SELECT form_id FROM form WHERE uuid='%s';" % form_uuid
    ).strip().splitlines()[-1])
    print(f"  ids: et_id={et_id} form_id={form_id} concepts_resolved={len(cid_by_uuid)}")

    qid_id = {name: cid_by_uuid[u] for name, u in qid.items()}
    cqid_id = {name: cid_by_uuid[u] for name, u in cqids.items()}

    print("\n== concept answers (MySQL) ==")
    total_links = 0
    for q in questions:
        name, answers = q["name"], q["answers"]
        if not answers:
            continue
        qcid = cqid_id[name]
        out = mysql_run(
            "SELECT COALESCE(MAX(sort_weight),0) FROM concept_answer "
            "WHERE concept_id=%d;" % qcid)
        next_w = int(out.strip().splitlines()[-1]) + 1
        q_links = 0
        for ans_n in answers:
            acid = qid_id[ans_n]
            out = mysql_run(
                "SELECT COUNT(*) FROM concept_answer "
                "WHERE concept_id=%d AND answer_concept=%d;" % (qcid, acid))
            if int(out.strip().splitlines()[-1]) == 0:
                mysql_run(
                    "INSERT INTO concept_answer (concept_id, answer_concept, "
                    "creator, date_created, sort_weight, uuid) VALUES "
                    "(%d, %d, 1, NOW(), %d, '%s');"
                    % (qcid, acid, next_w, str(uuid.uuid4())))
                next_w += 1
                q_links += 1
        if q_links:
            total_links += q_links
            print(f"  linked {q_links} answers -> {name}")
    print(f"  total answer links added: {total_links}")

    print("\n== patients ==")
    pid_by_index = []
    for p in data["patients"]:
        out = mysql_run(
            "SELECT pn.person_id FROM person_name pn "
            f"WHERE pn.given_name='{p['given_name']}' AND "
            f"pn.family_name='{p['family_name']}' AND pn.voided=0 LIMIT 1;")
        lines = [l for l in out.strip().splitlines() if l and not l.startswith("Warning")]
        if len(lines) >= 2:
            pid = int(lines[1])
            pid_by_index.append(pid)
            print(f"  exist {p['given_name']} {p['family_name']} -> person_id {pid}")
            continue
        pu = str(uuid.uuid4())
        sql = (
            "INSERT INTO person (gender, birthdate, birthdate_estimated, dead, "
            "creator, date_created, voided, uuid) VALUES "
            "('%s','%s',0,0,1,NOW(),0,'%s');\n"
            "SET @pid = LAST_INSERT_ID();\n"
            "INSERT INTO person_name (preferred, person_id, given_name, family_name, "
            "creator, date_created, voided, uuid) VALUES "
            "(1, @pid, '%s', '%s', 1, NOW(), 0, '%s');\n"
            "INSERT INTO person_address (person_id, preferred, city_village, "
            "county_district, creator, date_created, voided, uuid) VALUES "
            "(@pid, 0, '%s', '%s', 1, NOW(), 0, '%s');\n"
            "INSERT INTO patient (patient_id, creator, date_created, voided, "
            "allergy_status) VALUES (@pid, 1, NOW(), 0, 'Unknown');\n"
            "SELECT @pid;\n"
        ) % (p["gender"], p["birthdate"], pu,
             p["given_name"], p["family_name"], str(uuid.uuid4()),
             p["village"], p["chiefdom"], str(uuid.uuid4()))
        out = mysql_run(sql)
        pid = int(out.strip().splitlines()[-1])
        pid_by_index.append(pid)
        print(f"  {p['given_name']} {p['family_name']} -> person_id {pid}")

    print("\n== encounters ==")
    for e in data["encounters"]:
        pid = pid_by_index[e["patient"]]
        dt = f"{e['datestamp']} {e['time']}"
        out = mysql_run(
            "SELECT encounter_id FROM encounter WHERE patient_id=%d AND form_id=%d "
            "AND encounter_datetime='%s' AND voided=0 LIMIT 1;" % (pid, form_id, dt))
        lines = [l for l in out.strip().splitlines() if l and not l.startswith("Warning")]
        if len(lines) >= 2:
            eid = int(lines[1])
            print(f"  exist encounter {eid} [{e['description']}]")
            continue
        eu = str(uuid.uuid4())
        sql = (
            "INSERT INTO visit (patient_id, visit_type_id, date_started, creator, "
            "date_created, voided, uuid) VALUES (%d, 1, '%s', 1, NOW(), 0, '%s');\n"
            "SET @vid = LAST_INSERT_ID();\n"
            "INSERT INTO encounter (encounter_type, patient_id, location_id, "
            "form_id, encounter_datetime, creator, date_created, voided, visit_id, "
            "uuid) VALUES (%d, %d, NULL, %d, '%s', 1, NOW(), 0, @vid, '%s');\n"
            "SET @eid = LAST_INSERT_ID();\n"
            "INSERT INTO encounter_provider (encounter_id, provider_id, "
            "encounter_role_id, creator, date_created, voided, uuid) VALUES "
            "(@eid, 1, 1, 1, NOW(), 0, '%s');\n"
        ) % (pid, dt, str(uuid.uuid4()),
             et_id, pid, form_id, dt, eu,
             str(uuid.uuid4()))

        dt_by_q = {q["name"]: q["datatype"] for q in questions}
        rows = []
        for cname, val in e["obs"].items():
            cid = cqid_id[cname]
            if val is None or val == "":
                continue
            dtype = dt_by_q[cname]
            if dtype == "Date":
                rows.append((cid, "datetime", f"{val} 00:00:00", None))
            elif dtype == "Numeric":
                rows.append((cid, "numeric", val, None))
            elif dtype == "Text":
                rows.append((cid, "text", str(val), None))
            else:
                rows.append((cid, "coded", None, qid_id[val]))

        for cid, kind, textval, codedid in rows:
            if kind == "coded":
                sql += ("INSERT INTO obs (person_id, concept_id, encounter_id, "
                        "obs_datetime, location_id, value_coded, creator, "
                        "date_created, voided, uuid) VALUES (%d, %d, @eid, '%s', "
                        "NULL, %d, 1, NOW(), 0, '%s');\n"
                        % (pid, cid, dt, codedid, str(uuid.uuid4())))
            elif kind == "numeric":
                sql += ("INSERT INTO obs (person_id, concept_id, encounter_id, "
                        "obs_datetime, location_id, value_numeric, creator, "
                        "date_created, voided, uuid) VALUES (%d, %d, @eid, '%s', "
                        "NULL, %s, 1, NOW(), 0, '%s');\n"
                        % (pid, cid, dt, textval, str(uuid.uuid4())))
            elif kind == "datetime":
                sql += ("INSERT INTO obs (person_id, concept_id, encounter_id, "
                        "obs_datetime, location_id, value_datetime, creator, "
                        "date_created, voided, uuid) VALUES (%d, %d, @eid, '%s', "
                        "NULL, '%s', 1, NOW(), 0, '%s');\n"
                        % (pid, cid, dt, textval, str(uuid.uuid4())))
            else:  # text
                sql += ("INSERT INTO obs (person_id, concept_id, encounter_id, "
                        "obs_datetime, location_id, value_text, creator, "
                        "date_created, voided, uuid) VALUES (%d, %d, @eid, '%s', "
                        "NULL, '%s', 1, NOW(), 0, '%s');\n"
                        % (pid, cid, dt, textval.replace("'", "''"), str(uuid.uuid4())))

        sql += "SELECT @eid;\n"
        out = mysql_run(sql)
        eid = int(out.strip().splitlines()[-1])
        print(f"  encounter {eid} [{e['description']}]: patient {pid}, "
              f"{len(e['obs'])} obs -> {eu}")

    print("\nDONE")


if __name__ == "__main__":
    main()