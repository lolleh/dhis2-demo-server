#!/usr/bin/env python3
import os, subprocess, sys, time

R = "/home/ubuntu/dhis2-demo-server"
os.chdir(R)
WT = "openmrs-forms/above-five-treatment-register/openmrs-patched.war"
real = subprocess.run(["sha256sum", WT], capture_output=True, text=True).stdout.split()[0]
def store_path(oid): return f".git/lfs/objects/{oid[:2]}/{oid[2:4]}/{oid}"

print(f"real oid ver of worktree WAR now: {real}")
print(f"store path: {store_path(real)}")

if not os.path.exists(store_path(real)):
    os.makedirs(os.path.dirname(store_path(real)), exist_ok=True)
    subprocess.run(["cp", "--reflink=auto", WT, store_path(real)], check=True)
    print(f"restored store object from worktree, {os.path.getsize(store_path(real))} bytes")
else:
    print(f"store object present, {os.path.getsize(store_path(real))} bytes; verifying sha...")
    h = subprocess.run(["sha256sum", store_path(real)], capture_output=True,
                       text=True).stdout.split()[0]
    print(f"  store sha ok: {h == real}")

print("\n=== recompute ALL interlevel pointers so every omod/war oid exists in-store (no (missing)) ===")
# git lfs prune would delete tmp; instead just ensure every tracked file has an object.
out = subprocess.run(["git", "lfs", "ls-files", "-l"], capture_output=True, text=True).stdout
for line in out.splitlines():
    parts = line.split()
    if "oid sha256:" not in line:  # older format "oid <oid>  size <n>"
        oid = parts[1]
    else:
        oid = parts[0]
    szline = [p for p in parts if p.isdigit()]
    if not os.path.exists(store_path(oid)):
        # find the matching worktree file and seed from it
        wf = line.split()[-1]
        p = os.path.join(R, wf)
        if os.path.exists(p):
            os.makedirs(os.path.dirname(store_path(oid)), exist_ok=True)
            subprocess.run(["cp", "--reflink=auto", p, store_path(oid)], check=True)
            print(f"  seeded {oid[:10]} <- {wf}")
        else:
            print(f"  !! no worktree file for {oid[:10]} ({wf})")
print("pointer<->store reconciliation done")

print("\n=== PHASE 1: dedicated LFS object transport (own process), foreground, monitored ===")
# reset any leftover tmp
for f in os.listdir(".git/lfs/tmp"):
    pass
t0 = time.time()
log = open("/tmp/opencode/lfs2.log", "w")
p = subprocess.Popen(["git", "lfs", "push", "--all", "origin",
                      subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True,
                                     text=True).stdout.strip()],
                     stdout=log, stderr=log)
print(f"lfs push pid {p.pid} started at {time.strftime('%H:%M:%S')}")
sys.stdout.flush()
while p.poll() is None:
    time.sleep(10)
    el = int(time.time() - t0)
    tmp = 0
    try:
        tmp = max((os.path.getsize(os.path.join(".git/lfs/tmp", f))
                   for f in os.listdir(".git/lfs/tmp")), default=0)
    except Exception:
        pass
    print(f"  +{el:3d}s alive | lfs tmp bytes = {tmp:>12,}  ({tmp/1048576:6.1f} MiB)")
    sys.stdout.flush()
print(f"lfs push exited rc={p.returncode} after {int(time.time()-t0)}s")
log.close()
print(open("/tmp/opencode/lfs2.log").read()[-1200:])
sys.exit(p.returncode)
