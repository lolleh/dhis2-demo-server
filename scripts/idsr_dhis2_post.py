#!/usr/bin/env python3
"""Replay bridge's exact POST /api/dataValueSets (mapping-8 weekly targets) and dump
full import summary so we see the ACTUAL rejection reason (not a guess)."""
import base64, json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8091"
AUTH = base64.b64encode(b"admin:district").decode()
DATAVALUES = [
    {"dataElement": "vq2qO3eTrNi", "categoryOptionCombo": "HllvX50cXC0", "period": "2026W38",
     "orgUnit": "IDZUW0zA8F7", "value": 47},
    {"dataElement": "ekJQ3Ek3Rfg", "categoryOptionCombo": "HllvX50cXC0", "period": "2026W38",
     "orgUnit": "IDZUW0zA8F7", "value": 12},
    {"dataElement": "tnrawl1n9fk", "categoryOptionCombo": "HllvX50cXC0", "period": "2026W38",
     "orgUnit": "IDZUW0zA8F7", "value": 9},
    {"dataElement": "vq2qO3eTrNi", "categoryOptionCombo": "HllvX50cXC0", "period": "2026W38",
     "orgUnit": "IDZUW0zA8F7", "value": 8},
]

def api(method="POST", path="/api/dataValueSets", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Basic "+AUTH})
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            return resp.getcode(), json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"").decode("utf-8", "replace")[:4000]
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

code, r = api(body={"dataSet": "y77LiPqLMoq", "orgUnit": "IDZUW0zA8F7",
                    "period": "2026W38", "dataValues": DATAVALUES})
print("== POST /api/dataValueSets ==")
print("   HTTP %d" % code)
if isinstance(r, dict):
    for k in ("status","importCount","conflicts","dataSet","orgUnit","period","created"):
        v = r.get(k)
        if v is not None:
            if k == "conflicts":
                print("   conflicts[%d]:" % len(v))
                for c in v[:10]: print("      %s" % json.dumps(c))
            else:
                print("   %s: %s" % (k, json.dumps(v)[:200]))
elif isinstance(r, str):
    print("   body: %s" % r[:600])
