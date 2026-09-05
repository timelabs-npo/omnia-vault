#!/usr/bin/env python3
from __future__ import annotations
import base64, gzip, hashlib, io, json, pathlib, tarfile, sys

ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text())


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

parts = []
for row in MANIFEST["transport"]["parts"]:
    p = ROOT / row["name"]
    if not p.is_file():
        raise SystemExit(f"FAIL missing transport part: {row['name']}")
    data = p.read_bytes()
    if len(data) != row["size"] or sha256(data) != row["sha256"]:
        raise SystemExit(f"FAIL transport part mismatch: {row['name']}")
    parts.append(data)

encoded = b"".join(parts)
if len(encoded) != MANIFEST["base64_chars"]:
    raise SystemExit("FAIL base64 length")
archive = base64.b64decode(encoded, validate=True)
if len(archive) != MANIFEST["gzip_bytes"] or sha256(archive) != MANIFEST["gzip_sha256"]:
    raise SystemExit("FAIL gzip archive identity")

tar_bytes = gzip.decompress(archive)
if sha256(tar_bytes) != MANIFEST["tar_sha256"]:
    raise SystemExit("FAIL tar identity")

found: dict[str, bytes] = {}
with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:") as tf:
    for member in tf.getmembers():
        if not member.isfile():
            continue
        f = tf.extractfile(member)
        if f is None:
            raise SystemExit(f"FAIL unreadable tar member: {member.name}")
        found[member.name] = f.read()

failures = []
for row in MANIFEST["files"]:
    data = found.get(row["path"])
    if data is None:
        failures.append((row["path"], "missing"))
        continue
    if len(data) != row["size"] or sha256(data) != row["sha256"]:
        failures.append((row["path"], len(data), sha256(data), row["size"], row["sha256"]))

if failures:
    print("FAIL", failures)
    sys.exit(1)
print(f"PASS: {len(parts)} transport parts, archive {MANIFEST['gzip_sha256']}, {len(MANIFEST['files'])} files")
