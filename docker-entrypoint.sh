#!/bin/sh
set -e
node packages/db/dist/migrate.js
exec node apps/api/dist/main.js
