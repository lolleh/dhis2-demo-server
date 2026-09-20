#!/usr/bin/env python3
"""Replay the EXACT DHIS2 import DHIS2-the-bridge does (GET import summaries) to learn
WHY the 409. Not a guess: mirrors bridge/src/clients/dhis2.js request() byte-for-byte."""
import base64, json, subprocess, sys, time, urllib.request, urllib.error

DHIS2_BASE = "http://127.0.0.1:8091"
AUTH       = base64.b64encode(b"admin:district").decode()

def api(headers, method="GET", path="/api", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(DHIS2_BASE+path, data=data, method=method,
                                 headers=dict(headers, Authorization="Basic "+AUTH))
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            raw = resp.read().decode("utf-8","replace")
            try: return resp.getcode(), json.loads(raw)
            except Exception: return resp.getcode(), raw
    except urllib.error.HTTPError as e:
        raw = (e.read() or b"").decode("utf-8","replace")[:4000]
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw
    except Exception as ex:
        return None, {"net": str(ex)[:200]}

code, r = api({}, "GET", "/api/dataValueSets?dataSet=y77LiPqLMoq&orgUnit=IDZUW0zA8F7&period=2026W38")
print("== A. live DHIS2: weekly dataValueSets (raw) ==")
print("   %d -> %s" % (code, json.dumps(r)[:2000]))

print("\n== B. confirm target orgUnit exists under this OU tree + actually assigned? ==")
code, r = api({}, "GET", "/api/orgUnits?filter=id:eq:IDZUW0zA8F7&fields=id,name")
print("   %d -> %s" % (code, json.dumps(r)[:300]))
code, r = api({}, "GET",
  "/api/organisationUnits/IDZUW0zA8F7?fields=id,name,dataset[dataSetElements[dataElement[id,name,code]],orgUnit-orgUnitGroups[code]]")
print("   %d -> %s" % (code, json.dumps(r)[:700]))
