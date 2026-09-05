# Deprecated raw patch partition

Do not use `patch-parts/part-*` for reconstruction. During connector publication, large raw diff fragments were observed to drift/truncate. That transport failure was detected and disclosed before finalization.

The authoritative exact representation is `../exact-patch-gzip-base64/`. Its eight small blobs were created from local bytes and their Git blob SHAs matched local `git hash-object` identities before attachment. `verify.sh` reconstructs the exact 84,637-byte r2 patch and checks SHA-256 `594bab835d3f0a909efd70a312992ca5a3a666025309a5128e20cabc57697c47`.
