#!/usr/bin/env bash
set -u
cd /home/ubuntu/dhis2-demo-server || exit 1
LOG=/tmp/opencode/push4.log
MENT=media.githubusercontent.com
echo "push4 start $(date -u +%H:%M:%S)" > $LOG

echo "== 1. kill every straggler, then verify local object still intact ==" >> $LOG
pkill -9 -f "git-lfs pre-push" 2>/dev/null; pkill -9 -f "git-remote-https" 2>/dev/null
sleep 3
OID=cb15fa29e017d9413db63cbcc8c08c321f77df16fd0b0ef3e771e1e9af1194
OBJ=$(git rev-parse --git-path lfs/objects/$OID)
echo "  obj=$OBJ size=$(stat -c%s "$OBJ" 2>/dev/null) sha=$(sha256sum "$OBJ" 2>/dev/null | cut -c1-64)" >> $LOG

echo "== 2. PHASE-A: dedicated transport for LFS objects ONLY (own git process, own transport channel) ==" >> $LOG
cd /home/ubuntu/dhis2-demo-server
GIT_LFS_SPARSE_CHECKOUT=0 git lfs push origin 953a534d40e461c27896977b152b03e5c117d6dd 2>&1 | tail -4 >> $LOG
echo "  phase-A rc=${PIPESTATUS[0]}" >> $LOG
echo "  (log tail)"; 
