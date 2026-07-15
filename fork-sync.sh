#!/usr/bin/env bash
# Sync the fork by merging upstream into the single long-lived local branch.
set -euo pipefail

DO_PUSH=1
DO_TEST=1
DO_DRIFT=1
for arg in "$@"; do
	case "$arg" in
		--no-push) DO_PUSH=0 ;;
		--no-test) DO_TEST=0 ;;
		--no-drift) DO_DRIFT=0 ;;
		*) echo "Unknown option: $arg" >&2; exit 2 ;;
	esac
done

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mxx %s\033[0m\n' "$*" >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
[[ -z "$(git status --porcelain)" ]] || die "Working tree is not clean. Commit or stash changes first."
[[ "$(git branch --show-current)" == "local" ]] || die "Run fork-sync.sh from the local branch."
git config user.name >/dev/null 2>&1 || git config user.name "fork-sync"
git config user.email >/dev/null 2>&1 || git config user.email "fork-sync@users.noreply.github.com"
[[ ! -x .fork/setup-fork.sh ]] || ./.fork/setup-fork.sh >/dev/null

say "Fetching upstream and origin"
git fetch upstream --prune --tags
git fetch origin --prune

# main is only a local mirror pointer; no checkout or rewritten feature branches.
git branch -f main upstream/main >/dev/null
if [[ "$DO_PUSH" -eq 1 ]]; then
	git push origin upstream/main:main
fi

if [[ "$DO_DRIFT" -eq 1 && -f .fork/fork-drift-check.py ]]; then
	say "Checking which fork patches upstream may have absorbed"
	python3 .fork/fork-drift-check.py || warn "Review REDUNDANT/CHECK entries after this sync."
fi

if git merge-base --is-ancestor main local; then
	say "Already current with upstream/main"
	if [[ "$DO_PUSH" -eq 1 ]]; then
		git push origin local
	fi
	exit 0
fi

backup="backup/sync-$(date +%Y%m%d-%H%M%S)/local"
git tag "$backup" local

abort_merge() {
	git merge --abort >/dev/null 2>&1 || true
}
trap abort_merge ERR INT TERM

say "Merging upstream/main into local"
if ! git merge --no-ff --no-commit main; then
	# Generated catalogs have no hand-written resolution: take upstream, then the
	# build below regenerates them from the merged sources.
	mapfile -t conflicted < <(git diff --name-only --diff-filter=U)
	for file in "${conflicted[@]}"; do
		case "$file" in
			packages/ai/src/*.generated.ts|packages/ai/src/providers/*.models.ts)
				git checkout --theirs -- "$file"
				git add "$file"
				;;
		esac
	done

	remaining="$(git diff --name-only --diff-filter=U)"
	if [[ -n "$remaining" ]]; then
		printf '%s\n' "$remaining" >&2
		abort_merge
		die "Upstream overlaps fork code. Run 'git merge main', resolve the listed files on local, test, and commit. Backup: $backup"
	fi
fi

if [[ "$DO_TEST" -eq 1 ]]; then
	if [[ "${FORK_SYNC_NPM_CI:-0}" == "1" ]]; then
		say "Installing dependencies"
		npm ci --ignore-scripts --no-audit --no-fund
	fi

	say "Building"
	npm run build

	# Stage generated model catalogs rewritten by the build. Everything else was
	# already staged by the merge; an unstaged file here is an unexpected side effect.
	git add 'packages/ai/src/*.generated.ts' 'packages/ai/src/providers/*.models.ts' 2>/dev/null || true
	unexpected="$(git diff --name-only)"
	[[ -z "$unexpected" ]] || die "Unexpected build changes:\n$unexpected"

	say "Running focused fork checks"
	(
		cd packages/coding-agent
		npx vitest --run --maxWorkers=1 --pool=forks \
			test/theme-missing-tokens.test.ts \
			test/footer-width.test.ts \
			test/theme-toolpath.test.ts \
			test/markdown-path-linkify.test.ts
	)
fi

git commit -m "merge: sync upstream/main into local"
trap - ERR INT TERM

if [[ "$DO_PUSH" -eq 1 ]]; then
	git push origin local
fi

say "Done"
echo "local now contains upstream/main plus the fork patches. Backup: $backup"
