import subprocess, sys, bcrypt

CONTAINER = "dhis2-demo-server-db-1"
DBUSER    = "dhis"
DBNAME    = "dhis"
USERNAME  = "vlolleh"
NEWPASS   = "password123"

def psql(sql):
    p = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql",
         "-U", DBUSER, "-d", DBNAME, "-tA"],
        input=sql, capture_output=True, text=True)
    return p

def esc(s):
    return s.replace("'", "''")

newhash = bcrypt.hashpw(NEWPASS.encode(), bcrypt.gensalt(10)).decode()

sql = "update userinfo set password='" + esc(newhash) + "' where username='" + USERNAME + "';"
r = psql(sql)
if r.returncode != 0:
    print("UPDATE-ERR:", r.stderr.strip()[:200]); sys.exit(1)
print("update-vlolleh   rc={}".format(r.returncode))

back = psql("select password from userinfo where username='" + USERNAME + "';")
h2 = back.stdout.strip()
ok = bcrypt.checkpw(NEWPASS.encode(), h2.encode()) if h2.startswith("$2") else False
print("readback-match   {}".format("PASS" if ok else "FAIL"))

uid = psql("select userid from userinfo where username='" + USERNAME + "';").stdout.strip()
roles = psql("select roleid from userrole where name like '%Superuser%' or name like '%Admin%';").stdout.split()
for rid in roles:
    ins = "insert into userrolemembership(userid, roleid) values ('" + uid + "', '" + rid + "') on conflict do nothing;"
    psql(ins)
cnt = psql("select count(*) from userrolemembership where userid='" + uid + "';").stdout.strip()
print("vlolleh-roles    {} (after copy of superuser/admin roleids)".format(cnt))
