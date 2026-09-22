#!/usr/bin/env python3
"""FINAL smoke-step: replay the EXACT DHIS2 dataValueSets POST the bridge makes for
mapping-8 (same payload keys, same auth, same endpoint) and print the *full* 409
importSummary reason + the 4 live DE targets. Read-only, no DB writes."""
import base64, json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"
AUTH = base64.b64encode(b"admin:district").decode()

# authoritative from live bridge /api/mappings/8 (fetched below, not guessed)
def http(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": "Basic "+AUTH})
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            raw = resp.read().decode("utf-8","replace")
            try: return resp.getcode(), json.loads(raw)
            except Exception: return resp.getcode(), raw
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"").decode("utf-8","replace")[:4000]
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

print("== 1. live bridge mapping-8 element mappings (authoritative DE targets) ==")
m = httpb("/api/mappings/8") if False else None
import urllib.request as urq
bapi = "http://127.0.0.1:4000/api/mappings/8"
breq = urllib.request.Request(bapi, headers={"Authorization":"Basic "+AUTH})
try:
    with urllib.request.urlopen(breq, timeout=60) as resp:
        m8 = json.loads(resp.read().decode())
    for e in m8.get("element_mappings", []):
        print("   src=%s tgt=%s xform=%s" %
              (str(e.get("source_element"))[:12], e.get("target_element"), e.get("transformation")))
    tar = {e["target_element"] for e in m8.get("element_mappings", [])}
    ds, ou = m8.get("target_data_set"), m8.get("target_org_unit")
    print("   ds=%s ou=%s period_type=%s" % (ds, ou, m8.get("period_type")))
except Exception as e:
    print("   bridge fetch failed:", str(e)[:120]); sys.exit(1)

print("\n== 2. DHIS2 8091 live: the mapping's TARGET dataset — real DE ids inside it ==")
code, r = http("/api/dataSets/%s?fields=id,name,periodType,organisationUnits[id,name,code],dataSetElements[dataElement[id,name,code,valueType]]" % ds)
print("   %d" % code)
if isinstance(r, dict):
    print("   dataSet %s (%s) periodType=%s" % (r.get("id"), r.get("name"), r.get("periodType")))
    ous = (r.get("organisationUnits") or [])[:5]
    print("   orgUnits[%d]:" % len(r.get("organisationUnits") or []), "; ".join(
        "%s:%s:%s" % (o.get("id"), o.get("name"), o.get("code")) for o in ous))
    des = r.get("dataSetElements") or []
    print("   dataElements[%d]:" % len(des))
    for de in des:
        d = de.get("dataElement", {})
        print("      %s  %-24s %s" % (d.get("id"), d.get("name"), d.get("valueType")))
    print("\n   => do our 4 mapped DE ids exist in this dataSet?", 
          "YES (all match)" if tar <= {de["dataElement"]["id"] for de in des} else
          "MISSING: "+",".join(sorted(tar - {de["dataElement"]["id"] for de in des})))

print("\n== 3. REPLAY the bridge's exact POST /api/dataValueSets (weekly, count values) ==")
dv = [
    {"dataElement": "vq2qO3eTrNi", "categoryOptionCombo": "HllvX50cXC0",
     "period": "2026W38", "orgUnit": ou, "value": 47},
    {"dataElement": "ekJQ3Ek3Rfg", "categoryOptionCombo": "HllvX50cXC0",
     "period": "2026W38", "orgUnit": ou, "value": 12},
    {"dataElement": "tnrawl1n9fk", "categoryOptionCombo": "HllvX50cXC0",
     "period": "2026W38", "orgUnit": ou, "value": 9},
    {"dataElement": "vq2qO3eTrNi", "categoryOptionCombo": "HllvX50cXC0",
     "period": "2026W38", "orgUnit": ou, "value": 8},
]
code, r = http("/api/dataValueSets", "POST", {"dataSet": ds, "orgUnit": ou, "period": "2026W38", "dataValues": dv})
print("   HTTP %d" % code)
if isinstance(r, dict):
    print(json.dumps(r, indent=1)[:2600])
else:
    print(str(r)[:2600])
