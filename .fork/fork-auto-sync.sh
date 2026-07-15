#!/usr/bin/env bash
#
# fork-auto-sync.sh — unattended daily wrapper around fork-sync.sh.
#
# Legacy local fallback for machines that do not use the GitHub Actions sync.
# Do not enable both schedulers. It:
#   1. Runs fork-sync.sh from local (merge + build + tests), so dist/ is rebuilt
#      in place and the ~/.local/bin/pi shim launches current code.
#   1b. Updates installed pi packages (`pi update --extensions`) with the
#      freshly built fork CLI, so git/npm extensions track their remotes
#      without a manual `pi update --extensions`. Best-effort: a failed
#      extension fetch is logged but never fails the unit or masks a sync
#      conflict.
#   2. Logs everything (timestamped) under $XDG_STATE_HOME/pi-fork/.
#   3. On a conflict/error (fork-sync.sh exits nonzero), writes a CONFLICT
#      marker file and exits nonzero so the systemd unit is marked failed.
#      Both the marker and `systemctl --user status fork-sync` surface it.
#   4. On success, clears any stale marker.
#
# It NEVER forces past a source conflict: fork-sync.sh aborts and this wrapper
# reports it. Resolve the overlap on local, test, and push (see FORK.md).
#
# Manual run:  bash .fork/fork-auto-sync.sh
set -uo pipefail

REPO_ROOT="${FORK_SYNC_ROOT:-/home/lab/pi-fork}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/pi-fork"
LOG="$STATE_DIR/auto-sync.log"
MARKER="$STATE_DIR/CONFLICT"
# Keep the daily run from colliding with itself if a previous one is still going.
LOCK="$STATE_DIR/auto-sync.lock"

mkdir -p "$STATE_DIR"

# Single-instance guard (flock if available; harmless no-op otherwise).
if command -v flock >/dev/null 2>&1; then
	exec 9>"$LOCK"
	if ! flock -n 9; then
		echo "$(date -Is) another fork-auto-sync is running; skipping." >> "$LOG"
		exit 0
	fi
fi

ts() { date -Is; }

{
	echo "==================================================================="
	echo "$(ts) fork-auto-sync starting (repo: $REPO_ROOT)"
} >> "$LOG"

cd "$REPO_ROOT" || { echo "$(ts) cannot cd to $REPO_ROOT" >> "$LOG"; exit 1; }

# Run the checked-out local branch's sync script. PATH must include node/npm;
# the systemd unit sets that. Capture fork-sync.sh's exit code, not tee's.
git switch local >> "$LOG" 2>&1 || exit 1
bash ./fork-sync.sh 2>&1 | tee -a "$LOG"
rc="${PIPESTATUS[0]}"

# Update installed pi packages (git/npm extensions) with the freshly built fork
# CLI. Extensions live under ~/.pi/agent and are independent of the fork merge,
# so run this regardless of the sync result and keep it non-fatal: a flaky
# extension fetch must not mask a real sync conflict or trip the CONFLICT marker.
# PI_SKIP_VERSION_CHECK matches the ~/.local/bin/pi launcher (a self-maintained
# fork must never self-update into the npm package).
CLI_JS="$REPO_ROOT/packages/coding-agent/dist/cli.js"
if [[ -f "$CLI_JS" ]]; then
	echo "$(ts) updating pi extensions" >> "$LOG"
	if PI_SKIP_VERSION_CHECK=1 node "$CLI_JS" update --extensions >> "$LOG" 2>&1; then
		echo "$(ts) pi extensions up to date" >> "$LOG"
	else
		echo "$(ts) WARNING: pi extension update failed (non-fatal); see log above" >> "$LOG"
	fi
else
	echo "$(ts) WARNING: $CLI_JS missing; skipped extension update" >> "$LOG"
fi

if [[ "$rc" -eq 0 ]]; then
	echo "$(ts) fork-auto-sync OK" >> "$LOG"
	rm -f "$MARKER"
	exit 0
fi

# Non-zero: fork-sync.sh aborted on source overlap or validation failure.
# Record a marker with the tail of the log so it is
# obvious what needs a manual resolve.
{
	echo "fork-auto-sync FAILED at $(ts) (exit $rc)"
	echo "Upstream overlaps fork code or validation failed."
	echo "Resolve the listed files on local, complete the merge, test, and push:"
	echo "  cd $REPO_ROOT && git switch local"
	echo "Full log: $LOG"
	echo "--- last 25 log lines ---"
	tail -n 25 "$LOG"
} > "$MARKER"

echo "$(ts) fork-auto-sync FAILED (exit $rc); wrote $MARKER" >> "$LOG"
exit "$rc"
