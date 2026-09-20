#!/usr/bin/env python3
"""Final: reproduce bridge's EXACT DHIS2 import with authoritative ids, print RAW 409 summary."""
import base64, json, urllib.request, urllib.error

BRIDGE = "http://127.0.0.1:4000"
DHIS2  = "http://127.0.0.1:8091"
AUTH   = base64.b64encode(b"admin:district").decode()

def req(base, path, method="GET", body=None, raw=False):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(base+path, data=data, method=method,
        headers={"Content-Type":"application/json","Authorization":"Basic "+AUTH})
    try:
        with urllib.request.urlopen(r, timeout=300) as resp:
            b = resp.read()
            if raw: return resp.getcode(), b.decode("utf-8","replace")
            try: return resp.getcode(), json.loads(b.decode("utf-8","replace"))
            except Exception: return resp.getcode(), b.decode("utf-8","replace")
    except urllib.error.HTTPError as e:
        b = e.read() or b""
        if raw: return e.code, b.decode("utf-8","replace")
        try: return e.code, json.loads(b.decode("utf-8","replace"))
        except Exception: return e.code, b.decode("utf-8","replace")
    except Exception as ex:
        return None, str(ex)[:200]

print("== live mapping 8: REAL target DE ids (element_mappings), not guesses ==")
c, m8 = req(BRIDGE, "/api/mappings/8")
refs = []
for em in (m8.get("element_mappings") or []):
    tgt = em.get("target_element")
    refs.append(tgt)
    print("   %s -> %s (%s)" % (em.get("source_element"), tgt, em.get("transformation")))
if m8.get("additional_query") and "groupBy" in str(m8.get("additional_query", "")):
    pass
ds, ou = m8.get("target_data_set"), m8.get("target_org_unit")
print("   target_data_set=%s  target_org_unit=%s  period_type=%s" % (ds, ou, m8.get("period_type")))

print("\n== exact bridge-client POST /dataValueSets (body shape = dhis2.js line 107) ==")
values = [47, 12, 9, 8]
payload = {"dataSet": ds, "orgUnit": ou, "period": "2026W38",
           "dataValues": [{"dataElement": de, "categoryOptionCombo": "HllvX50cXC0",
                            "value": str(v)} for de, v in zip(refs, values)]}
c, r = req(DHIS2, "/api/dataValueSets", "POST", payload, raw=True)
print("HTTP %s" % c)
print(r[:6000])
