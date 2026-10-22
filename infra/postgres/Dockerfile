# postgres:16-bookworm ships without ca-certificates, so apt falls back to
# plain HTTP for large package downloads — which this environment's network
# can intercept mid-transfer. Install ca-certificates over HTTP first (small
# metadata/package fetches are fine), then switch apt to HTTPS before
# pulling the larger PostGIS/pgvector packages.
FROM postgres:16-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|http://apt.postgresql.org|https://apt.postgresql.org|g' /etc/apt/sources.list.d/*.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       postgresql-16-postgis-3 \
       postgresql-16-postgis-3-scripts \
       postgresql-16-pgvector \
       postgresql-contrib \
    && rm -rf /var/lib/apt/lists/*
