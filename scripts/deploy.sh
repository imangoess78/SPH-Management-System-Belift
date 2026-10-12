#!/usr/bin/env bash
# Deploy SPH Management System ke Cloudflare Pages.
#
# Token dibaca di dalam skrip (bukan di baris perintah) supaya perintah yang
# panjang tidak rusak oleh penyaringan rahasia di log.
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN_FILE="${SPH_CF_TOKEN_FILE:-$HOME/.config/sph/cloudflare-token}"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "Token tidak ditemukan: $TOKEN_FILE" >&2
  exit 1
fi
export CLOUDFLARE_API_TOKEN="$(tr -d '\n\r' < "$TOKEN_FILE")"

npx wrangler pages deploy dist \
  --project-name sph-management-clone \
  --branch main
