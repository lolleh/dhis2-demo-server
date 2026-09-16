#!/usr/bin/env python3
import os, subprocess, sys, time

R = "/home/ubuntu/dhis2-demo-server"
os.chdir(R)
HEAD = git rev-parse HEAD
HEAD = HEAD.strip()
HEAD = "0d927f9ccc011544668022ea4bf481c16111ef43"
OID  = "cb15fa29e017d9413db63cbcc8caf08c321f77df16fd0b0ef3e771e1e9af1194"
WAR  = "openmrs-forms/above-five-treatment-register/openmrs-patched.war"

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True)

def L(m=""):
    print(m, flush=True)

L("migrated head : %s" % HEAD)
L("pointer oid   : %s" % OID)

st = ".git/lfs/objects/%s/%s/%s" % (OID[:2], OID[2:4], OID)
present = os.path.isfile(st) and os.path.getsize(st) == 186493848
sha_ok = False
if present:
    sha_ok = sh("sha256sum", st).stdout.split()[0] == OID
L("store obj     : present=%s sha_ok=%s" % (present, sha_ok))
if not (present and sha_ok):
    L("  !! abort: store not valid")  ; sys.exit(3)

L("")
L("=== git lfs push (own transport; the REAL 186MB object now at the correct path) ===")
t0 = time.time()
log = open("/tmp/opencode/lfs_migpush.log", "w")
p = subprocess.Popen(["git", "lfs", "push", "--all", "origin", HEAD, "-j", "1"],
                     stdout=log, stderr=subprocess.STDOUT, bufsize=1)
last_tmp = -1
while p.poll() is None:
    line = log.readline()
    if line:
        s = line.strip()
        if s: L("  " + s)
    # tmp growth = bytes landed (probe every 20s)
    time.sleep(20)
    try:
        import glob
        tmps = glob.glob(".git/lfs/tmp/*")
        tot = sum(os.path.getsize(f) for f in tmps if os.path.isfile(f))
    except Exception:
        tot = 0
    if tot != last_tmp:
        L("  [+%3ds] tmp=%10d bytes" % (int(time.time()-t0), tot))
        last_tmp = tot
    if time.time() - t0 > 3000:
        L("  TIMEOUT 50min"); p.kill(); break
rc = p.wait()
L("  rc=%d  elapsed=%dm%02ds" % (rc, int((time.time()-t0)//60), int(time.time()-t0)%60))
log.close()
# tail
for ln in open("/tmp/opencode/lfs_migpush.log").read().splitlines()[-4:]:
    L("    " + ln)
sys.exit(rc)
