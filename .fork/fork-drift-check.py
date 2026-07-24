#!/usr/bin/env python3
"""Evaluate fork-feature drift against upstream.

Reads .fork/fork-manifest.json and runs each feature's declared drift probe.

Exit codes:
  0  all features are ACTIVE
  2  usage, manifest, ref, or probe error
  3  at least one feature is REDUNDANT
  4  at least one feature needs manual CHECK (and none are REDUNDANT/errors)
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

C_RESET = "\033[0m"
C_GREEN = "\033[1;32m"
C_YELLOW = "\033[1;33m"
C_RED = "\033[1;31m"
C_CYAN = "\033[1;36m"
C_DIM = "\033[2m"
SEMVER = re.compile(
    r"^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
    r"(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$"
)


class ProbeError(Exception):
    """A Git or probe failure that is not a normal missing path."""


def run_git(*args):
    env = dict(os.environ)
    env["LC_ALL"] = "C"
    return subprocess.run(
        ["git", *args], capture_output=True, text=True, encoding="utf-8", errors="replace", env=env
    )


def validate_ref(ref, validated_refs):
    if ref in validated_refs:
        return
    result = run_git("rev-parse", "--verify", f"{ref}^{{commit}}")
    if result.returncode != 0:
        raise ProbeError(f"invalid or unfetched ref {ref}: {result.stderr.strip()}")
    validated_refs.add(ref)


def git_path_exists(ref, path):
    """Use machine-readable tree output instead of localized Git diagnostics."""
    result = run_git("ls-tree", "-z", "--name-only", ref, "--", path)
    if result.returncode != 0:
        raise ProbeError(f"git ls-tree {ref} -- {path} failed: {result.stderr.strip()}")
    return path in result.stdout.split("\0")


def git_show(ref, path):
    """Return file contents at <ref>:<path>, or None if the path is absent."""
    if not git_path_exists(ref, path):
        return None
    result = run_git("show", f"{ref}:{path}")
    if result.returncode == 0:
        return result.stdout
    raise ProbeError(f"git show {ref}:{path} failed: {result.stderr.strip()}")


def parse_semver(text):
    match = SEMVER.fullmatch(text.strip())
    if not match:
        return None
    core = tuple(int(value) for value in match.group(1, 2, 3))
    prerelease = match.group(4)
    identifiers = None if prerelease is None else prerelease.split(".")
    if identifiers is not None and any(identifier.isdigit() and len(identifier) > 1 and identifier[0] == "0" for identifier in identifiers):
        return None
    return core, identifiers


def semver_gte(left, right):
    if left[0] != right[0]:
        return left[0] > right[0]
    left_pre, right_pre = left[1], right[1]
    if left_pre is None or right_pre is None:
        return left_pre is None
    for left_id, right_id in zip(left_pre, right_pre):
        if left_id == right_id:
            continue
        left_num, right_num = left_id.isdigit(), right_id.isdigit()
        if left_num and right_num:
            return int(left_id) > int(right_id)
        if left_num != right_num:
            return not left_num
        return left_id > right_id
    return len(left_pre) >= len(right_pre)


def json_dig(obj, dotted):
    current = obj
    for key in dotted.split("."):
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current


def require_string(obj, key, context):
    value = obj.get(key)
    if not isinstance(value, str) or not value:
        raise ProbeError(f"{context}.{key} must be a non-empty string")
    return value


def validate_manifest(manifest):
    if not isinstance(manifest, dict):
        raise ProbeError("manifest root must be an object")
    features = manifest.get("features")
    if not isinstance(features, list):
        raise ProbeError("manifest.features must be an array")
    for index, feature in enumerate(features):
        context = f"features[{index}]"
        if not isinstance(feature, dict):
            raise ProbeError(f"{context} must be an object")
        require_string(feature, "branch", context)
        probe = feature.get("drift")
        if not isinstance(probe, dict):
            raise ProbeError(f"{context}.drift must be an object")
        probe_type = require_string(probe, "type", f"{context}.drift")
        required = {
            "grep-absent": ("file", "pattern"),
            "grep-present": ("file", "pattern"),
            "path-absent": ("path",),
            "path-present": ("path",),
            "version-gte": ("file", "jsonPath", "minVersion"),
        }.get(probe_type)
        if required is None:
            raise ProbeError(f"{context}.drift has unknown probe type {probe_type}")
        for key in required:
            require_string(probe, key, f"{context}.drift")
        if "ref" in probe and (not isinstance(probe["ref"], str) or not probe["ref"]):
            raise ProbeError(f"{context}.drift.ref must be a non-empty string")


def evaluate(probe, ref, ref_overridden, validated_refs):
    """Return (status, detail), with status ACTIVE/REDUNDANT/CHECK/ERROR."""
    probe_type = probe["type"]
    probe_ref = ref if ref_overridden else probe.get("ref", ref)
    validate_ref(probe_ref, validated_refs)

    if probe_type in ("grep-absent", "grep-present"):
        content = git_show(probe_ref, probe["file"])
        if content is None:
            return "CHECK", f"{probe['file']} not found at {probe_ref}"
        try:
            found = re.search(probe["pattern"], content) is not None
        except re.error as error:
            return "ERROR", f"invalid regex /{probe['pattern']}/: {error}"
        status = "REDUNDANT" if found else "ACTIVE"
        return status, f"/{probe['pattern']}/ {'found' if found else 'absent'} in {probe['file']}"

    if probe_type in ("path-absent", "path-present"):
        exists = git_path_exists(probe_ref, probe["path"])
        status = "REDUNDANT" if exists else "ACTIVE"
        return status, f"{probe['path']} {'exists' if exists else 'absent'} at {probe_ref}"

    if probe_type == "version-gte":
        content = git_show(probe_ref, probe["file"])
        if content is None:
            return "CHECK", f"{probe['file']} not found at {probe_ref}"
        try:
            data = json.loads(content)
        except json.JSONDecodeError as error:
            return "ERROR", f"cannot parse {probe['file']}: {error}"
        raw = json_dig(data, probe["jsonPath"])
        if raw is None:
            return "CHECK", f"{probe['jsonPath']} missing in {probe['file']}"
        have = parse_semver(str(raw))
        want = parse_semver(probe["minVersion"])
        if have is None or want is None:
            return "ERROR", f"unparseable semver: have={raw} want={probe['minVersion']}"
        redundant = semver_gte(have, want)
        return (
            "REDUNDANT" if redundant else "ACTIVE",
            f"upstream version {raw} {'>=' if redundant else '<'} {probe['minVersion']}",
        )

    return "ERROR", f"unknown probe type: {probe_type}"


def main(argv):
    manifest_path = Path(".fork/fork-manifest.json")
    ref_arg = None
    quiet = False
    args = list(argv[1:])
    while args:
        argument = args.pop(0)
        if argument in ("--manifest", "--ref"):
            if not args:
                sys.stderr.write(f"missing value for {argument}\n")
                return 2
            value = args.pop(0)
            if argument == "--manifest":
                manifest_path = Path(value)
            else:
                ref_arg = value
        elif argument == "--quiet":
            quiet = True
        else:
            sys.stderr.write(f"unknown arg: {argument}\n")
            return 2

    try:
        manifest = json.loads(manifest_path.read_text())
        validate_manifest(manifest)
        ref = ref_arg or manifest.get("upstreamRef", "upstream/main")
        if not isinstance(ref, str) or not ref:
            raise ProbeError("upstreamRef must be a non-empty string")
        validated_refs = set()
        fallback_is_used = bool(ref_arg) or any("ref" not in feature["drift"] for feature in manifest["features"])
        if fallback_is_used:
            validate_ref(ref, validated_refs)
    except (OSError, json.JSONDecodeError, ProbeError) as error:
        sys.stderr.write(f"cannot use manifest {manifest_path}: {error}\n")
        return 2

    if not quiet:
        print(f"{C_CYAN}Fork drift check against {ref}{C_RESET}")
        print(f"{C_DIM}(REDUNDANT = upstream may have absorbed this; review for removal){C_RESET}\n")

    redundant, checks, errors = [], [], []
    width = max((len(feature["branch"]) for feature in manifest["features"]), default=10)
    for feature in manifest["features"]:
        try:
            status, detail = evaluate(feature["drift"], ref, bool(ref_arg), validated_refs)
        except (ProbeError, KeyError, TypeError, ValueError) as error:
            status, detail = "ERROR", str(error)
        if status == "ACTIVE":
            color = C_GREEN
        elif status == "REDUNDANT":
            color = C_YELLOW
            redundant.append(feature["branch"])
        elif status == "CHECK":
            color = C_YELLOW
            checks.append(feature["branch"])
        else:
            color = C_RED
            errors.append(feature["branch"])
        if not quiet:
            print(f"  {color}{status:<9}{C_RESET} {feature['branch']:<{width}}  {C_DIM}{detail}{C_RESET}")

    if not quiet:
        print()
        if redundant:
            print(f"{C_YELLOW}{len(redundant)} feature(s) look REDUNDANT — consider dropping.{C_RESET}")
        if checks:
            print(f"{C_YELLOW}{len(checks)} feature(s) need a manual CHECK.{C_RESET}")
        if errors:
            print(f"{C_RED}{len(errors)} probe error(s) — fix the manifest.{C_RESET}")
        if not (redundant or checks or errors):
            print(f"{C_GREEN}All features ACTIVE. Nothing to drop.{C_RESET}")

    if errors:
        return 2
    if redundant:
        return 3
    if checks:
        return 4
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
