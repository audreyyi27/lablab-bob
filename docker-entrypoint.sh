#!/bin/sh
set -e
cd /app/backend
. ./venv/bin/activate
exec npm run dev
