import subprocess, bcrypt

CONT = "dhis2-demo-server-db-1"
DBU  = "dhis"
DBD  = "dhis"
TGT  = "vlolleh"
PASS = "password123"

def psql(sql):
    p = subprocess.run(["docker","exec","-i",CONT,"psql","-U",DBU,"-d",DBD,"-tA"],
                       input=sql, capture_output=True, text=True)
    return p

def esc(s):
    return s.replace("'", "''")

hash_b64 = bcrypt.hashpw(PASS.encode(), bcrypt.gensalt(10)).decode()
print("step1  host-bcrypt hash computed (len=%d)" % len(hash_b64))

r = psql("update userinfo set password='" + esc(hash_b64) + "' where username='" + esc(TGT) + "';\n")
print("step2  update rc=%d err=%s" % (r.returncode, (r.stderr.strip()[:50] or "OK")))

back = psql("select password from userinfo where username='" + esc(TGT) + "';\n").stdout.strip()
ok = back and back.startswith("$2") and bcrypt.checkpw(PASS.encode(), back.encode())
print("step3  readback+bcrypt-verify=%s" % ("PASS" if ok else "FAIL"))

# copy admin's superuser role memberships onto vlolleh
uid = psql("select userid from userinfo where username='" + esc(TGT) + "';\n").stdout.strip()
aid = psql("select userid from userinfo where username='admin';\n").stdout.strip()
if uid and aid:
    roles = psql("select roleid from userrolemembership where userid='" + aid + "';\n").stdout.split()
    for rid in roles:
        psql("insert into userrolemembership(userid,roleid) values ('" + uid + "','" + rid + "') on conflict do nothing;\n")
    cnt = psql("select count(*) from userrolemembership where userid='" + uid + "';\n").stdout.strip()
    print("step4  copied %d admin roles -> vlolleh; membership rows now=%s" % (len(roles), cnt))
