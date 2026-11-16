#!/usr/bin/env bash
# Periksa tabel kalkulator di D1 produksi. Token dibaca dari berkas supaya
# tidak muncul di baris perintah.
set -euo pipefail
export CLOUDFLARE_API_TOKEN="$(tr -d '\n\r' < "$HOME/.config/sph/cloudflare-token")"
cd "$(dirname "$0")/.."
npx wrangler d1 execute sph-management-db --remote --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'kalkulator%' ORDER BY name" \
  | grep -o '"name": "[^"]*"'
