#!/usr/bin/env python3
import os, subprocess, sys, time

R = "/home/ubuntu/dhis2-demo-server"
os.chdir(R)

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True)

def L(m):
    print(m, flush=True)

WT = "openmrs-forms/above-five-treatment-register/openmrs-patched.war"
STOCK_W = "openmrs-forms/above-five-treatment-register/openmrs-patched.war"  # rebuild target if needed

L("migrated head  : %s" % sh("git", "rev-parse", "HEAD").stdout.strip())
oid = sh("git", "lfs", "ls-files", "--long").stdout
for ln in oid.splitlines():
    if "openmrs-patched.war" in ln:
        oid = ln.split()[0]
        break
L("pointer oid    : %s" % oid)
st = ".git/lfs/objects/%s/%s/%s" % (oid[:2], oid[2:4], oid)
if not os.path.isfile(st):
    os.makedirs(os.path.dirname(st), exist_ok=True)
    s = subprocess.run(["cp", WT, st])
    L("seeded store obj: %s bytes (worktree WAR, sha-guard below)" % (s.returncode == 0 and os.path.getsize(st) or 0))
h = subprocess.run(["sha256sum", st], capture_output=True, text=True).stdout.split()[0]
L("store sha==oid  : %s   size=%s" % ("YES" if h == oid else "NO", os.path.getsize(st)))
L("")
L("=== PHASE-1: lfs push (own transport), 186MB, foreground, tmp-growth-monitored 25 min ===")
t0 = time.time()
log = open("/tmp/opencode/final1.log", "w")
p = subprocess.Popen(["git", "lfs", "push", "--all", "origin",
                      sh("git", "rev-parse", "HEAD").stdout.strip(), "-j", "1"],
                     stdout=log, stderr=subprocess.STDOUT, bufsize=1)
last = 0
while p.poll() is None:
    time.sleep(20)
    try:
        ts = sum(os.path.getsize(os.path.join(".git/lfs/tmp", f))
                 for f in os.listdir(".git/lfs/tmp")) if os.path.isdir(".git/lfs/tmp") else 0
    except Exception:
        ts = 0
    if ts != last:
        L("   +%3dm%02ds  tmp=%d bytes (%.1f MiB)" % ((int(time.time() - t0)//60),
                                                       int(time.time()-t0) % 60, ts, ts/1048576))
        last = ts
    if time.time() - t0 > 1560:
        p.kill(); L("   TIMEOUT after 26m"); break
rc = p.wait()
L("   lfs push rc=%d  elapsed=%dm%02ds" % (rc, int(time.time()-t0)//60, int(time.time()-t0) % 60))
L("   tail:"), [L("      " + l) for l in open("/tmp/opencode/final1.log").read().splitlines()[-3:]]
if rc == 0:
    L("")
    L("=== PHASE-2: ref push (LFS already there -> near-instant) ===")
    r = sh("git", "push", "origin", "HEAD:main")
    L("   rc=%d  %s" % (r.returncode, r.stdout.strip() or r.stderr.strip()))
sys.exit(rc)
