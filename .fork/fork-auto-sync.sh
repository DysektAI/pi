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
	if ! exec 9>"$LOCK"; then
		echo "$(date -Is) cannot open lock file $LOCK" >> "$LOG"
		exit 1
	fi
	if ! flock -n 9; then
		echo "$(date -Is) another fork-auto-sync is running; skipping." >> "$LOG"
		exit 0
	fi
fi

ts() { date -Is; }

record_failure() {
	local rc="$1"
	local reason="$2"
	{
		echo "fork-auto-sync FAILED at $(ts) (exit $rc)"
		echo "$reason"
		echo "Resolve the failure on local, complete validation, and push:"
		echo "  cd $REPO_ROOT && git switch local"
		echo "Full log: $LOG"
		echo "--- last 25 log lines ---"
		tail -n 25 "$LOG"
	} > "$MARKER"
	echo "$(ts) fork-auto-sync FAILED (exit $rc); wrote $MARKER" >> "$LOG"
	exit "$rc"
}

{
	echo "==================================================================="
	echo "$(ts) fork-auto-sync starting (repo: $REPO_ROOT)"
} >> "$LOG"

cd "$REPO_ROOT" || record_failure 1 "Cannot cd to $REPO_ROOT."

# Run the checked-out local branch's sync script. PATH must include node/npm;
# the systemd unit sets that. Capture fork-sync.sh's exit code, not tee's.
git switch local >> "$LOG" 2>&1 || record_failure 1 "Cannot switch to local."
bash ./fork-sync.sh 2>&1 | tee -a "$LOG"
rc="${PIPESTATUS[0]}"

# Update extensions only after a successful validated build. Never execute CLI
# output from a rejected or partially completed merge.
CLI_JS="$REPO_ROOT/packages/coding-agent/dist/cli.js"
if [[ "$rc" -eq 0 && -f "$CLI_JS" ]]; then
	echo "$(ts) updating pi extensions" >> "$LOG"
	if PI_SKIP_VERSION_CHECK=1 node "$CLI_JS" update --extensions >> "$LOG" 2>&1; then
		echo "$(ts) pi extensions up to date" >> "$LOG"
	else
		echo "$(ts) WARNING: pi extension update failed (non-fatal); see log above" >> "$LOG"
	fi
elif [[ "$rc" -eq 0 ]]; then
	echo "$(ts) WARNING: $CLI_JS missing; skipped extension update" >> "$LOG"
fi

if [[ "$rc" -eq 0 ]]; then
	echo "$(ts) fork-auto-sync OK" >> "$LOG"
	rm -f "$MARKER"
	exit 0
fi

record_failure "$rc" "Upstream overlaps fork code or validation failed."
