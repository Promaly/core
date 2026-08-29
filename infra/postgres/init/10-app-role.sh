#!/bin/sh
# Runs once, during first-time database initialisation. Creates the
# least-privilege role the API and worker connect as (DML only), reading its
# generated password from the secrets volume rather than an environment
# variable.
set -eu

PROMALY_APP_PASSWORD="$(cat /run/promaly/db_app_password)"
export PROMALY_APP_PASSWORD

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password PROMALY_APP_PASSWORD

CREATE ROLE promaly_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE promaly TO promaly_app;
GRANT USAGE ON SCHEMA public TO promaly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO promaly_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO promaly_app;
ALTER DEFAULT PRIVILEGES FOR ROLE promaly IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO promaly_app;
ALTER DEFAULT PRIVILEGES FOR ROLE promaly IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO promaly_app;
SQL
