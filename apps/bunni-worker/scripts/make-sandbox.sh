#!/usr/bin/env bash
# Builds a sandbox copy of the Bunni production environment for development and testing.
# Reads the real folder; never writes to it. The sandbox is a full copy with the job queues and
# the event log reset, so her interface tools (mock runner, integrity check) work unchanged.
set -euo pipefail
SRC="${1:-$HOME/Desktop/bunni}"
DST="${2:-$HOME/dev/bunni-sandbox}"
rm -rf "$DST"
mkdir -p "$DST"
rsync -a --exclude .DS_Store --exclude CLAUDE.md --exclude AGENTS.md "$SRC/" "$DST/"
for d in inbox outbox processing rejected simulated; do rm -rf "$DST/production/jobs/$d"; mkdir -p "$DST/production/jobs/$d"; done
: > "$DST/production/jobs/events.jsonl"
echo "SANDBOX COPY of $SRC made $(date -u +%FT%TZ). Not the production folder. Job queues and event log reset." > "$DST/SANDBOX.md"
echo "$DST"
