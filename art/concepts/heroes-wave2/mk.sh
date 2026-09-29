# usage: mk.sh out.html file...
out=$1; shift
{ echo '<html><body style="background:#3a3a44;margin:4px;font:11px sans-serif;color:#eee"><div style="display:grid;grid-template-columns:repeat(5,128px);gap:4px">'
for f in "$@"; do echo "<div><img src=\"data:image/png;base64,$(base64 -w0 $f)\" style=\"width:128px;height:128px;image-rendering:pixelated;background:#6a7480\"><div>$(basename $f .png)</div></div>"; done
echo '</div></body></html>'; } > $out
