import subprocess, bcrypt, urllib.request, json

C="dhis2-demo-server-db-1"; U="dhis"; D="dhis"
TARGET="vlolleh"; PASS="password123"

def esc(s): return s.replace("'","''")
def psql(sql):
    p=subprocess.run(["docker","exec","-i",C,"psql","-U",U,"-d",D,"-tA"],
                     input=sql,capture_output=True,text=True)
    return p
def q(sql): return psql(sql).stdout.strip()

# --- 1) resolve ids ---
uid=q("select userid from userinfo where username='"+esc(TARGET)+"';\n")
auid=q("select userid from userinfo where username='admin';\n")
print("vlolleh.uid=%s  admin.uid=%s" % (uid or "?", auid or "?"))

# --- 2) set password ---
h=bcrypt.hashpw(PASS.encode(),bcrypt.gensalt(12)).decode()
psql("update userinfo set password='"+esc(h)+"' where username='"+esc(TARGET)+"';\n")

# --- 3) copy every role from admin to vlolleh (if ids resolved) ---
if uid and auid:
    roleset=psql("select roleid from userrolemembership where userid='"+esc(auid)+"';\n")
    for rid in roleset.stdout.split():
        psql("insert into userrolemembership(userid,roleid) values ('"+
             esc(uid)+"','"+esc(rid)+"') on conflict do nothing;\n")
print("role memberships after copy = %s" % q("select count(*) from userrolemembership where userid='"+(uid or "''")+"';\n"))

# --- 4) HTTP: log in AS VLOLIEH against the real app with the NEW password ---
tok="Basic "+__import__("base64").b64encode((TARGET+":"+PASS).encode()).decode()
try:
    req=urllib.request.Request("http://127.0.0.1:8091/api/me",headers={"Authorization":tok})
    with urllib.request.urlopen(req,timeout=20) as r:
        j=json.loads(r.read()); print("HTTP /api/me as vlolleh -> rc=%d user=%s super=%s" % (r.status, j.get("username"), "F_SUPERUSER" in j.get("authorities",[])))
except Exception as e:
    print("HTTP /api/me as vlolleh -> rc=%s" % getattr(e,"code",e))
