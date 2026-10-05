#!/usr/bin/env bash
# Assemble the full into3.ai static site into build/site:
#   - the main site from the parent repository root (what GitHub Pages serves today)
#   - this project's dist/ under /landingpages/prelaunch/ (lp1, lp2, lp3, checkout, ...)
# Upload with: aws s3 sync build/site s3://<SiteBucketName> --delete
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
root="$(cd "$here/.." && pwd)"
out="$here/build/site"
rm -rf "$out"
mkdir -p "$out/landingpages/prelaunch"
rsync -a \
  --exclude '.git' --exclude '.gitignore' --exclude '.DS_Store' --exclude 'node_modules' \
  --exclude 'into3-razorpay' --exclude 'Into3-Alok-Handoff' --exclude 'CNAME' --exclude '*.pdf' \
  --exclude 'server.js' --exclude 'lambda.js' --exclude 'package.json' --exclude 'package-lock.json' \
  --exclude '.env*' --exclude '.claude' --exclude '/build' --exclude '/infra' --exclude '.aws-sam' \
  "$root/" "$out/"
rsync -a --exclude '.DS_Store' "$here/dist/" "$out/landingpages/prelaunch/"
echo "Site assembled at $out ($(find "$out" -type f | wc -l | tr -d ' ') files)"
