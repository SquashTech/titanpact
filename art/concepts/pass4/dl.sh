#!/bin/sh
# usage: dl.sh name=jobid ...
cd "$(dirname "$0")"
for pair in "$@"; do n="${pair%%=*}"; j="${pair#*=}"; curl -sf -o "$n.png" "https://api.pixellab.ai/mcp/images/$j/download" && echo "ok $n" || echo "FAIL $n"; done
