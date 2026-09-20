#!/usr/bin/env python3
"""PRINT THE ENTIRE 409 response — nothing but the redirect + full dump."""
import base64, json, urllib.request, urllib.error
B="http://127.0.0.1:8091"
A=base64.b64encode(b"admin:District@1").decode()
T="oRly8VbUF6e"
body={"id":T,"username":"vlolleh","name":"Vamba Lolleh",
      "userCredentials":{
          "id":T,"username":"vlolleh",
          "userInfo":{"id":T,"username":"vlolleh"},
          "password":"password1","code":"vlolleh"}}
req=urllib.request.Request(B+"/api/users/"+T,data=json.dumps(body).encode(),method="PUT",
    headers={"Content-Type":"application/json","Authorization":"Basic "+A})
try:
    with urllib.request.urlopen(req,timeout=760) as r:
        print("HTTP",r.getcode()); print(r.read().decode("utf-8","replace"))
except urllib.error.HTTPError as e:
    raw=(e.read() or b"").decode("utf-8","replace")
    print("HTTP",e.code)
    try:
        d=json.loads(raw)
        print(json.dumps(d["response"],indent=1)[:2600] if "response" in d else raw[:1200])
    except Exception: print(raw[:1200])
