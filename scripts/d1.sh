#!/usr/bin/env bash
# Jalankan SQL ke D1 produksi sph-management-db.
# Pakai: ./scripts/d1.sh "SELECT 1;"
set -euo pipefail
cd "$(dirname "$0")/.."
export CLOUDFLARE_API_TOKEN="$(tr -d '\r\n' < "$HOME/.config/sph/cloudflare-token")"
npx wrangler d1 execute sph-management-db --remote --json --command "$1"
