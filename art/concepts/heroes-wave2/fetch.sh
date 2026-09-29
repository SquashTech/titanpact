while read n j; do [ -f $n.png ] && continue; curl -s -o $n.png https://api.pixellab.ai/mcp/images/$j/download; file $n.png | grep -q "PNG image" || rm -f $n.png; done < jobs.txt; ls *.png | wc -l
