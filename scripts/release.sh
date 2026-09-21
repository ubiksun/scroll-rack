#!/usr/bin/env bash
# Build + package a release. Usage: scripts/release.sh [notes]
#   → release/scroll-rack-vX.Y.Z.zip      (testers: unzip → Load unpacked / overwrite in place)
#   → release/store-vX.Y.Z.zip               (Chrome Web Store upload: no README)
#   → release/latest.json                    (in-app update check reads this from GitHub raw)
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(node -p "require('./public/manifest.json').version")
NOTES=${1:-}
npm run build >/dev/null
cp release/INSTALL.md dist/README-TESTERS.md
sed -i '' -E "s/v[0-9]+\.[0-9]+\.[0-9]+/v$VER/g" dist/README-TESTERS.md release/INSTALL.md
rm -rf release/.pack && mkdir -p "release/.pack/scroll-rack-v$VER"
cp -R dist/. "release/.pack/scroll-rack-v$VER/"
rm -f "release/scroll-rack-v$VER.zip" "release/store-v$VER.zip"
(cd release/.pack && zip -rq "../scroll-rack-v$VER.zip" "scroll-rack-v$VER" -x '*.DS_Store')
(cd dist && zip -rq "../release/store-v$VER.zip" . -x '*.DS_Store' -x 'README-TESTERS.md')
rm -rf release/.pack
ZIP_URL="https://github.com/ubiksun/scroll-rack/releases/download/v$VER/scroll-rack-v$VER.zip"
node -e "require('fs').writeFileSync('release/latest.json', JSON.stringify({version:'$VER', zip:'$ZIP_URL', notes:process.argv[1], date:new Date().toISOString().slice(0,10)}, null, 2)+'\n')" "$NOTES"
echo "v$VER →"; ls -1 release
