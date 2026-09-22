#!/usr/bin/env python3
import os, re, subprocess, sys, time

R = "/home/ubuntu/dhis2-demo-server"
os.chdir(R)
PID = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
LOG = "/tmp/opencode/lfs3.log"

def media_rx():
    s = subprocess.run(["ss", "-tnpi"], capture_output=True, text=True).stdout
    tot = 0
    for m in re.finditer(r"ESTAB.*?(?:\s(\d+):\d+)\s+(\S+):443", s):
        pass
    # simpler: sum rcv-q of sockets whose peer is a github-media host
    rx = 0
    for blk in s.splitlines():
        if "ESTAB" in blk and ("media.githubusercontent" in blk or "github" in blk or "githubusercontent" in blk or "github.com" in blk):
            m = re.search(r"\s(\d+)\s+0\s", blk)  # rcv-q <recv> send-q
            # ss -tnpi prints: <recv-q> <send-q> ... after the local addr
            m2 = re.search(r"ESTAB\s+(\d+)\s+(\d+)", blk)
            if m2:
                send_q = int(m2.group(2))
                rx += 0
    return 0

def github_media_rx():
    s = subprocess.run(["ss", "-tin"], capture_output=True, text=True).stdout
    total = 0
    conns = 0
    cur = None
    for line in s.splitlines():
        if "ESTAB" in line or line.startswith("State") or ":" not in line:
            continue
        # each -tin block: State RecvQ SendQ Local Peer (blank) then cwnd ... bytes_acked
        m = re.search(r"^(\S+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+):443", line)
        if m and ("github" in m.group(4) or "githubusercontent" in m.group(4) or "github.com" in m.group(5)):
            conns += 1
    return total, conns

def media_byte_progress():
    """read RX bytes of the media.githubusercontent connection from /proc/net/tcp is messy;
       use ss -tin 'bytes_acked' on the github-media ESTAB socket as upload progress."""
    s = subprocess.run(["ss", "-tin"], capture_output=True, text=True).stdout
    best = 0
    for blk in s.split("\n\n"):
        lines = blk.splitlines()
        if not lines:
            continue
        if "ESTAB" not in lines[0]:
            continue
        peer = lines[0].split()[-1]
        if not any(h in peer for h in ("githubusercontent.com", "github.com", "githubusercontent")):
            continue
        m = re.search(r"bytes_acked:(\d+)", blk)
        if m:
            best = max(best, int(m.group(1)))
    return best

t0 = time.time()
log = open(LOG, "w")
p = subprocess.Popen(["git", "lfs", "push", "--all", "origin", PID],
                     stdout=log, stderr=subprocess.STDOUT)
print(f"lfs push pid={p.pid} t0={t0:.0f}  (uploading 186MB WAR over its OWN transport)")
prev = 0
while p.poll() is None:
    time.sleep(12)
    rx = media_byte_progress()
    dt = int(time.time() - t0)
    rate = (rx - prev) / max(12, dt - prev_dt if False else 12)
    prev_dt = dt
    bar = "#" * int(rx / 8e6)
    print(f"  +{dt:3d}s  media.bytes_acked={rx/1048576:8.1f} MiB  {'' if rx else '(waiting for socket...)'}")
    prev = rx
    sys.stdout.flush()
print(f"EXIT rc={p.returncode} after {int(time.time()-t0)}s")
log.close()
tail = open(LOG).read()
print("\n--- lfs3.log tail (real evidence) ---")
print(tail[-900:])
sys.exit(p.returncode if p.returncode else 0)
