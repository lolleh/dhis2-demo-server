#!/usr/bin/env python3
"""Generate the HTML Form Entry layout for the "Under Five (General) Register".

Reads under-five-register-model.json for the question model, resolves numeric
concept ids from the OpenMRS database (via the openmrs-db container), then
writes under-five-register-htmlform.xml ready to be stored in the
htmlformentry_html_form table (legacy HTML form, same way the demo's Vitals /
Visit Note forms are stored).

Run from the repo root:
    python3 mockups/generate_under_five_html_form.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(ROOT, "mockups", "under-five-register-model.json")
OUT_PATH = os.path.join(ROOT, "mockups", "under-five-register-htmlform.xml")

FORM_NAME = "Under Five (General) Register"
FORM_VERSION = "1.0"
FORM_UUID = "26f8e5c5-8787-43bd-af4c-21674f434d37"
ENCOUNTER_TYPE_UUID = "86ebf7c6-2d9d-4ee5-9064-59a81b550e37"
ET_NAME = "Under Five Register"

MYSQL = ["docker", "exec", "-i", "dhis2-demo-server-openmrs-db-1",
         "mysql", "-uopenmrs", "-pAdmin123", "openmrs"]

# Section headings map every question to a register section. Names not listed
# here are collected into a trailing "Other" section (order preserved).
SECTIONS = [
    ("Register and visit details", [
        "District", "Facility Name", "Facility Type", "Chiefdom / Zone",
        "Register Year", "Register Month",
        "Service point (in facility / outreach)",
        "Type of visit (new / follow-up)",
    ]),
    ("Child identification and disability", [
        "Age in months", "Sex (M/F)", "Chiefdom / Village",
        "Screened for disability", "Disability present", "Disability type",
    ]),
    ("Anthropometry and vital signs", [
        "Temperature (C)", "Weight (kg)", "Height / Length (cm)",
        "MUAC (cm)", "WHZ score", "WAZ score", "Oxygen saturation (%)",
    ]),
    ("Presenting complaint and feeding", [
        "Presenting complaint",
        "Exclusive breastfeeding (child < 6 months)",
        "Continued breastfeeding (child 6-23 months)",
    ]),
    ("General danger signs", [
        "Unable to drink or breastfeed", "Vomiting everything",
        "History of convulsion", "Convulsing now",
        "Lethargic or unconscious", "Skin pinch",
    ]),
    ("Cough or difficult breathing", [
        "Cough or difficult breathing", "Duration of cough (days)",
        "Respiratory rate (per minute)", "Chest indrawing",
        "Stridor present",
    ]),
    ("Diarrhoea", [
        "Diarrhoea", "Duration of diarrhoea (days)", "Blood in stool",
        "Sunken eyes", "Weak to drink", "Eager / thirsty drinking",
        "Skin pinch goes back slowly",
    ]),
    ("Fever, measles and other signs", [
        "Fever", "Measles in last 3 months", "Generalized rash of measles",
        "Cough / runny nose / red eyes",
        "Mouth ulcer / pus draining eyes / corneal clouding",
        "Palmar pallor",
    ]),
    ("Ear problems", [
        "Ear problem", "Ear pain", "Ear discharge",
    ]),
    ("Malnutrition and oedema", [
        "Visible severe wasting", "Pitting oedema of both feet",
        "MUAC category", "WHZ category", "Appetite test",
    ]),
    ("HIV and immunisation", [
        "HIV RDT result", "HIV microscopy result",
        "Immunisation up to date", "Immunisation age band",
        "Albendazole status", "Vitamin A dose band",
        "Vitamin A received within last 6 months",
        "Albendazole received within last 6 months",
        "Other problems",
    ]),
    ("Classification and treatment", [
        "Disease classification", "Treatment given (medicine)",
        "Malaria treatment timing",
        "Counsel mother on feeding", "Counsel mother on when to return",
    ]),
    ("Referral and follow-up", [
        "Referred to health facility", "Pre-referral treatment given",
        "Follow up date", "Outcome",
    ]),
    ("Supplies issued and remarks", [
        "Albendazole 400 mg (count)", "Amoxicillin 250 mg (count)",
        "ACT paediatric (2-11 months) (count)", "ACT (1-5 years) (count)",
        "ORS sachets (count)", "Paracetamol 100 mg (count)",
        "Zinc 20 mg (count)", "Rectal artesunate suppositories (count)",
        "Artesunate 60 mg/ml injection (count)", "Oxygen therapy",
        "Other drug (specify)", "Remarks",
    ]),
]

LONG_TEXT = {
    "Chiefdom / Village", "Presenting complaint", "Treatment given (medicine)",
    "Referred to health facility", "Other drug (specify)", "Remarks",
    "Other problems",
}

YN = {"Yes", "No"}

# Question names whose concept lives in the demo data under a different label.
# "Temperature (C)" is concept 5088 "Température (c)"; the register obs use it.
OVERRIDES = {
    "Temperature (C)": 5088,
}


def mysql_run(sql):
    p = subprocess.run(MYSQL, input=sql, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if p.returncode != 0:
        sys.stderr.write(f"mysql error: {p.stderr}\n{sql[:800]}\n")
        raise SystemExit(1)
    return p.stdout


def resolve_ids():
    # Exact-name matches (voided names and retired concepts excluded).
    out = mysql_run("SELECT c.concept_id, cn.name, cn.concept_name_type "
                    "FROM concept c JOIN concept_name cn "
                    "ON cn.concept_id=c.concept_id "
                    "WHERE cn.voided=0 AND c.retired=0 "
                    "AND cn.locale='en';")
    by_name = {}
    for line in out.strip().splitlines():
        if not line or line.startswith("Warning"):
            continue
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        try:
            cid, name, ntype = int(parts[0]), parts[1], parts[2]
        except ValueError:
            continue
        by_name.setdefault(name, []).append((cid, ntype))

    ids = {}
    for name, matches in by_name.items():
        fsn = [cid for cid, t in matches if t == "FULLY_SPECIFIED"]
        if len(fsn) == 1:
            ids[name] = fsn[0]
        elif len(fsn) == 0 and len({cid for cid, _ in matches}) == 1:
            ids[name] = matches[0][0]

    # Fall back to the concept actually used by the Under Five register
    # encounters, for names the demo spells differently (e.g. Temperature (C)
    # is stored as concept 5088 "Température (c)").
    out = mysql_run(
        "SELECT o.concept_id, cn.name FROM obs o JOIN encounter e "
        "ON e.encounter_id=o.encounter_id JOIN form f ON f.form_id=e.form_id "
        "JOIN concept_name cn ON cn.concept_id=o.concept_id "
        "AND cn.concept_name_type='FULLY_SPECIFIED' AND cn.voided=0 "
        "WHERE f.uuid='%s' GROUP BY o.concept_id, cn.name;" % FORM_UUID)
    obs_name_to_id = {}
    for line in out.strip().splitlines():
        if not line or line.startswith("Warning"):
            continue
        parts = line.split("\t")
        if len(parts) == 2:
            try:
                obs_name_to_id.setdefault(parts[1], int(parts[0]))
            except ValueError:
                pass
    for name, cid in obs_name_to_id.items():
        ids.setdefault(name, cid)
    ids.update(OVERRIDES)
    return ids


def esc(text):
    return (str(text).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def widget(question, concept_id):
    dtype = question["datatype"]
    answers = question.get("answers") or []
    name = question["name"]
    if dtype == "Numeric":
        return f'<obs conceptId="{concept_id}" />'
    if dtype == "Date":
        return f'<obs conceptId="{concept_id}" dateFormat="dd/mm/yyyy" />'
    if dtype == "Text":
        size = ' size="60"' if name in LONG_TEXT else ' size="30"'
        return f'<obs conceptId="{concept_id}"{size} />'
    if dtype == "Coded":
        if set(answers) == YN:
            return f'<obs conceptId="{concept_id}" style="radio" />'
        return (f'<obs conceptId="{concept_id}" style="dropdown" '
                f'nullOption="[Choose]" />')
    raise SystemExit(f"unhandled datatype {dtype!r} for {name!r}")


def row_for(question, concept_id):
    label = esc(question["name"])
    return (f'          <tr>\n'
            f'            <td class="label">{label}:</td>\n'
            f'            <td>{widget(question, concept_id)}</td>\n'
            f'          </tr>')


def build_xml(ids):
    model = json.load(open(MODEL_PATH, encoding="utf-8"))
    questions = model["concepts"]["questions"]

    missing = [q["name"] for q in questions if q["name"] not in ids]
    if missing:
        sys.stderr.write("no concept for: " + ", ".join(missing) + "\n")
        raise SystemExit(1)
    no_answers = []
    for q in questions:
        if q["datatype"] == "Coded":
            out = mysql_run("SELECT COUNT(*) FROM concept_answer "
                            "WHERE concept_id=%d;" % ids[q["name"]])
            n = int(out.strip().splitlines()[-1])
            if n == 0:
                no_answers.append(q["name"])
    if no_answers:
        sys.stderr.write("coded concepts without answers: "
                         + ", ".join(no_answers) + "\n")
        raise SystemExit(1)

    placed = {}
    blocks = []
    for heading, names in SECTIONS:
        qs = [q for q in questions if q["name"] in names]
        placed.update((q["name"], True) for q in qs)
        if not qs:
            continue
        body = "\n".join(row_for(q, ids[q["name"]]) for q in qs)
        blocks.append(
            f'      <h4 class="section">{heading}</h4>\n'
            f'      <table class="underfive">\n{body}\n      </table>')
    catch_all = [q for q in questions if q["name"] not in placed]
    if catch_all:
        body = "\n".join(row_for(q, ids[q["name"]]) for q in catch_all)
        blocks.append(
            f'      <h4 class="section">Other</h4>\n'
            f'      <table class="underfive">\n{body}\n      </table>')

    covered = {q["name"] for q in questions}
    assert covered == set(covered) | set(placed) | {q["name"] for q in catch_all}

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<htmlform formUuid="{FORM_UUID}" formName="{FORM_NAME}" '
        f'formEncounterType="{ENCOUNTER_TYPE_UUID}" formVersion="{FORM_VERSION}">\n\n'
        '    <style type="text/css">\n'
        '        #who-when-where { margin-bottom: 8px; }\n'
        '        #who-when-where p { display: inline-block; padding-right: 24px; }\n'
        '        h4.section { margin: 14px 0 4px; border-bottom: 1px solid #ccc; '
        'color: #555; }\n'
        '        table.underfive { border-collapse: collapse; }\n'
        '        table.underfive tr { border-bottom: 1px solid #eee; }\n'
        '        table.underfive td { padding: 3px 10px 3px 0; }\n'
        '        td.label { font-weight: bold; white-space: nowrap; }\n'
        '        .field-error { color: #ff6666; font-size: 1.1em; display: block; }\n'
        '    </style>\n\n'
        '    <div id="who-when-where">\n'
        '        <p id="who">\n'
        '            <label>Provider:</label>\n'
        '            <span><encounterProvider default="currentUser" required="true" /></span>\n'
        '        </p>\n'
        '        <p id="where">\n'
        '            <label>Location:</label>\n'
        '            <span><encounterLocation /></span>\n'
        '        </p>\n'
        '        <p id="when">\n'
        '            <label>Date:</label>\n'
        '            <span><encounterDate id="encounterDate" default="now" /></span>\n'
        '        </p>\n'
        '    </div>\n\n'
        '    <h3>Under Five (General) Register</h3>\n\n'
        + "\n".join(blocks) +
        '\n\n'
        '    <div id="buttons">\n'
        '        <submit submitClass="confirm right" submitCode="general.save"/>\n'
        '        <button type="button" class="cancel">'
        '<uimessage code="general.cancel"/></button>\n'
        '    </div>\n'
        '</htmlform>\n'
    )
    return xml


def main():
    ids = resolve_ids()
    xml = build_xml(ids)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(xml)
    print(f"OK wrote {OUT_PATH} ({len(xml)} bytes, {ids and 'concepts resolved'})")
    print(f"question concepts resolved: {len(ids)}")


if __name__ == "__main__":
    main()