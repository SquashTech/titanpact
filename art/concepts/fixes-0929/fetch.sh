#!/bin/sh
# fetch.sh: download every job in jobs.txt that isn't on disk yet
cd "$(dirname "$0")"
while read name id; do
  [ -s "$name.png" ] && continue
  curl -s -o "$name.png" "https://api.pixellab.ai/mcp/images/$id/download"
  file "$name.png" | grep -q PNG || rm -f "$name.png"
done < jobs.txt
ls *.png 2>/dev/null | wc -l
