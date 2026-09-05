#!/usr/bin/env bash
# STEP 1 only. Fresh local clones; no architectural analysis, builds, pushes,
# source changes, or automatic uploads. Run with Bash (including macOS Bash 3.2).
set -euo pipefail
umask 077

ROOT="${1:?Usage: bash rhea-step1.sh /absolute/path/to/new-workspace}"
case "$ROOT" in /*) ;; *) echo 'Workspace must be an absolute path.' >&2; exit 2;; esac
for tool in git gh node npm npx jq shasum; do
  command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool" >&2; exit 2; }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Node.js 22+ required"); process.exit(2); }'
gh auth status --hostname github.com >/dev/null 2>&1 || {
  echo 'Authenticate first: gh auth login --hostname github.com' >&2; exit 2;
}
[ ! -e "$ROOT" ] || { echo "Refusing to overwrite existing path: $ROOT" >&2; exit 2; }
mkdir -p "$ROOT"/sources "$ROOT"/snapshots "$ROOT"/logs "$ROOT"/control
ROOT="$(cd "$ROOT" && pwd -P)"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
trap 'rc=$?; if [ "$rc" -ne 0 ]; then printf "Stopped (exit %s). Local diagnostics: %s/logs\n" "$rc" "$ROOT" >&2; fi' EXIT

cat > "$ROOT/repomix.config.json" <<'JSON'
{"include": ["**/*.proto", "**/*.schema.json", "**/*.h", "**/*.hpp", "**/*.go", "**/*.swift", "**/*.ts", "**/openapi.yaml", "**/go.mod", "**/Package.swift"], "ignore": ["**/tests/**", "**/logs/**", "**/*.bin", "**/build/**", "**/vendor/**", "**/node_modules/**", "**/assets/**", "**/*.md", "**/*.txt"]}
JSON

jq '{include: .include, ignore: {customPatterns: .ignore},
     output: {removeComments: false, patterns:
       (["**/*.proto", "**/*.schema.json", "**/openapi.yaml",
         "**/go.mod", "**/Package.swift"] |
        map({pattern: ., compress: false}))},
     security: {enableSecurityCheck: true}}' \
  "$ROOT/repomix.config.json" > "$ROOT/repomix.runtime.json"

VERSION="$(npm view repomix version)"
[ -n "$VERSION" ] || { echo 'Could not resolve Repomix version.' >&2; exit 2; }
printf '%s\n' "$VERSION" > "$ROOT/logs/repomix.version"
printf 'Workspace: %s\nRepomix: %s\n' "$ROOT" "$VERSION"

gh api --hostname github.com --paginate \
  'orgs/timelabs-npo/repos?type=all&per_page=100' \
  --jq '.[].full_name' > "$ROOT/logs/repositories.list"
printf '%s\n' 'serg-alexv/hme' >> "$ROOT/logs/repositories.list"
LC_ALL=C sort -u "$ROOT/logs/repositories.list" > "$ROOT/control/repositories.list"
: > "$ROOT/logs/manifest.jsonl"

record() {
  jq -nc --arg repository "$repo" --arg status "$1" \
    --arg branch "$branch" --arg commit "$commit" \
    --arg snapshot "$snapshot" --arg sha256 "$digest" \
    --arg log "logs/$slug.log" --arg captured_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{repository:$repository, status:$status, branch:$branch, commit:$commit,
      snapshot:$snapshot, sha256:$sha256, captured_at:$captured_at,
      local_log:$log}' >> "$ROOT/logs/manifest.jsonl"
}

while IFS= read -r repo <&3; do
  [ -n "$repo" ] || continue
  slug="${repo//\//__}"
  dir="$ROOT/sources/$repo"
  log="$ROOT/logs/$slug.log"
  branch=''; commit=''; snapshot=''; digest=''
  printf 'Packing %s\n' "$repo"
  mkdir -p "$(dirname "$dir")"
  if ! GIT_LFS_SKIP_SMUDGE=1 GIT_TERMINAL_PROMPT=0 \
      gh repo clone "$repo" "$dir" -- --depth 1 --single-branch > "$log" 2>&1; then
    record clone_failed; continue
  fi
  if ! commit="$(git -C "$dir" rev-parse --verify HEAD 2>> "$log")"; then
    commit=''; record no_commit; continue
  fi
  branch="$(git -C "$dir" symbolic-ref --quiet --short HEAD || printf 'DETACHED')"
  git -C "$dir" ls-tree -r --full-tree HEAD > "$ROOT/logs/$slug.tree.txt"
  tmp="$ROOT/logs/$slug.partial.json"
  if ! (cd "$ROOT/control" && npx --yes "repomix@$VERSION" "$dir" \
      --config "$ROOT/repomix.runtime.json" \
      --style json --compress --no-git-sort-by-changes \
      --output "$tmp") >> "$log" 2>&1; then
    record pack_failed; continue
  fi
  if ! jq -e 'type == "object"' "$tmp" >/dev/null 2>> "$log"; then
    record invalid_json; continue
  fi
  snapshot="$slug.pack.json"
  mv "$tmp" "$ROOT/snapshots/$snapshot"
  digest="$(shasum -a 256 "$ROOT/snapshots/$snapshot" | awk '{print $1}')"
  record packed
done 3< "$ROOT/control/repositories.list"

jq -s --arg started_at "$STARTED" --arg completed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg repomix_version "$VERSION" \
  --slurpfile selector "$ROOT/repomix.config.json" \
  --slurpfile runtime "$ROOT/repomix.runtime.json" \
  '{project:"rhea-project", phase:"step1", started_at:$started_at,
    completed_at:$completed_at, repomix_version:$repomix_version,
    selector:$selector[0], runtime_config:$runtime[0],
    invocation:{style:"json", compress:true, git_sort_by_changes:false},
    security_review:"pending_local_review_of_logs_and_outputs",
    coverage:{scope:"accessible remote repositories; default-branch committed HEADs",
      other_branches:false, local_uncommitted_work:false,
      submodule_contents:false, lfs_objects_downloaded:false,
      gitignore_and_default_exclusions:true, source_implementations_verified:false},
    extraction_complete:(all(.[]; .status == "packed")), repositories:.}' \
  "$ROOT/logs/manifest.jsonl" > "$ROOT/snapshots/manifest.json"

cat > "$ROOT/control/INIT.txt" <<'PROMPT'
Initialize a local architecture coordination session for Rhea-project v2.0.
INITIALIZATION ONLY. STEP 2 is blocked until the user uploads snapshots to the
main architecture chat and explicitly releases the parsing task here.
Read only this prompt and, if necessary, ../snapshots/manifest.json.
Do not open source files, pack files, repository instructions, or logs now.
Do not parse interfaces, cluster domains, correlate data, design architecture,
change source repositories, create branches, build, install, or upload anything.

Carry forward these evaluation constraints without deciding any architecture:
- Rhea-play is the proposed AI-driven multimodal UI engine, not a proven center.
- Target native clients: iOS, macOS, Windows 11 Pro. Practical O-Exp utility only.
- Requirements/contracts and independent validation must remain physically and
  logically separate; an agent must not self-certify its implementation.
- The Consistency Protocol and key component must follow actual contract,
  dependency, and data-flow evidence, with gaps and uncertainty explicit.
- Treat mbsd (custom OpenBSD distribution) and proprietary tribunal+rheknel
  (three AI models in one native OpenBSD executable over ollama+rheknel) as
  extremely difficult, unverified integration nodes, not demonstrated builds.
- Legacy names in scope: Core, Apps, Nexus, Omnia, Blueshoes,
  Rheknel+mbsd+tribunal, Security Council, bs.macos, 001 New, hme, Keyki.
- Main-chat inputs must be bounded structural records with source provenance,
  never raw implementations. Agent access is capability-based, not simulated
  by writing an @mention. Do not claim an agent ran without an execution result.
- Future deliverables, after evidence gathering: decision map; cohesive system
  description; nomenclature mapping; per-folder instruction boundaries; key
  component finding; consistency protocol; independent contract-driven TDD
  roadmap; documentation blueprint. Do not produce them during this turn.

Return only a JSON object containing project, phase, gate, analysis_started,
where gate is "awaiting_snapshot_upload_and_parsing_release" and
analysis_started is false. Then stop.
PROMPT

printf '\nSnapshots: %s/snapshots\n' "$ROOT"
printf 'Review local logs and outputs before uploading; no automatic upload occurred.\n'
jq -r '.repositories[] | [.repository,.status,.commit] | @tsv' "$ROOT/snapshots/manifest.json"
if ! jq -e '.extraction_complete' "$ROOT/snapshots/manifest.json" >/dev/null; then
  printf '\nPartial extraction: consult manifest.json for missing evidence.\n' >&2
  exit 3
fi
printf '\nSTEP 1 finished. No STEP 2 parsing or architectural synthesis performed.\n'
