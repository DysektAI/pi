# Fork maintenance guide

This repository is a fork of [`earendil-works/pi`](https://github.com/earendil-works/pi)
(`upstream`) published at `DysektAI/pi` (`origin`).

## Branch model

| Branch | Role |
| --- | --- |
| `main` | Mirror pointer for `upstream/main`; `fork-sync.sh` refreshes it. |
| `local` | The single long-lived fork branch: upstream plus all fork commits. Build and run this branch. |
| other branches | Temporary development branches. Merge them into `local`, then delete them. |

`.fork/fork-manifest.json` inventories fork patches so the drift checker can
report when upstream appears to have absorbed one. It does not control git
history or branch rebuilding.

## Syncing with upstream

```bash
./fork-sync.sh             # merge upstream into local, build, test, push
./fork-sync.sh --no-push   # verify locally without pushing
./fork-sync.sh --no-test   # merge only
./fork-sync.sh --no-drift  # skip the absorbed-patch report
```

The script:

1. Requires a clean `local` checkout.
2. Fetches `upstream` and `origin`.
3. Moves the local `main` mirror to `upstream/main` and pushes that mirror.
4. Reports fork patches that upstream may have absorbed.
5. Tags the current `local` tip as `backup/sync-<timestamp>/local`.
6. Merges `main` into `local`.
7. Takes upstream versions of conflicted generated model catalogs, then
   regenerates them during the build.
8. Stops on genuine source overlap instead of guessing.
9. Builds, runs the focused fork checks, commits, and pushes `local`.

This uses normal merge history: no routine rebases, branch reconstruction, or
force-pushes. A conflict is therefore tied to real overlapping edits, not to
maintenance machinery.

## Automation

Use one scheduler only. GitHub Actions is preferred because it is independent
of a workstation. The local systemd timer is a fallback and should be disabled
when the GitHub workflow is enabled.

The scheduler should run `./fork-sync.sh`. If it fails, inspect the conflicting
files, resolve them on `local`, complete the merge, run the checks, and push.
Do not run `pi update` for the fork: that installs the official package rather
than integrating upstream source.

The fork launcher should keep `PI_SKIP_VERSION_CHECK=1`; successful sync runs
are the fork's update mechanism.

## Absorbed upstream features

Run:

```bash
python3 .fork/fork-drift-check.py
```

`REDUNDANT` is a review prompt, not automatic deletion. Confirm equivalent
upstream behavior, remove the fork implementation in a normal `local` commit,
and remove its manifest entry. No branch surgery is required.

## Adding or changing a fork feature

1. Branch from `local`: `git switch -c feat/my-feature local`.
2. Implement and test the change.
3. Merge it into `local`, then delete the temporary branch.
4. Add or update its drift probe in `.fork/fork-manifest.json`.
5. Run `./fork-sync.sh --no-push` before pushing.

Prefer Pi extensions, skills, settings, or packages over core patches whenever
they can provide the behavior. Every core patch is a potential future merge
conflict; extension-only customizations update independently.

## Recovery

Before every upstream merge, the script creates a backup tag. To abandon a bad
manual resolution:

```bash
git merge --abort
# or, after a completed bad merge (preserves later history):
git revert -m 1 <bad-merge-commit>
```

Check current divergence with:

```bash
git log --oneline local..upstream/main   # upstream commits not yet merged
git log --oneline upstream/main..local   # fork-only commits
```
