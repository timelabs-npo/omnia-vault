# Rhea / Omnia external audit index

**Audit branch:** `audit/rhea-step23-omnia-lit-001-v1.1-r2`  
**Frozen product baseline:** `f5995536fede02d403f0525ff9093996457efecb`  
**Publication state:** architecture/evidence/candidate publication complete; physical runtime qualification pending.

This branch is an audit publication branch. It does not claim that the Rust candidate compiled, executed, survived SIGKILL or power-loss simulation, or passed any `LIT-01..LIT-12` physical acceptance gate.

## Evidence chain

The material audit stages were committed independently rather than flattened into one final snapshot:

1. `60ed0c2a04a9393cccb29462cd00debcf3ad9724` — provenance and audit index freeze.
2. `4bdac89b607eb18e60372a187477428ec0639e89` — STEP 1 extraction protocol.
3. `6f4c80cefdc1b13c73f439a1c320febe98d73523` — STEP 2 semantic core.
4. `aa81ec34aece90fdc84f9b4628ca938577ec9f98` — source registry.
5. `122e95f4b3e55e2d18c2ea23c82fc5cd82cf3e18` — decisions and acceptance model.
6. `0999386da1562933bb35b66e5def50a7ac1643eb` — STEP 3 Master Plan synthesis.
7. `5b2c3e27e1d754c07ca9d936ad6186c5f97d625d` — independent review and bounded evidence receipts.
8. `f1a2f1237960362616a3948453c78af5b0506014` — OMNIA-LIT-001 v1.1 contract/oracle publication.
9. `53cd4090b2d26ed7e2e10479a9c6bd3a5f4a03b1` — external prose review retained as unverified input.
10. `506af7bd146f5ce94ad79943e8d3d1a52758ddb7` — r2 candidate repair/static evidence.
11. `5ee45701eede1f36ffe7eec40d5163f72a58d19f` — exact reconstructible r2 patch publication.
12. Later correction commits preserve the audit trail for transfer-integrity issues and restore byte-exact frozen oracle/golden-vector artifacts rather than rewriting history.
13. Archive, generated-artifact inventory and final publication-state commits are separate subsequent audit steps.

## Primary locations

- STEP2/3 evidence and Master Plan: `audit/rhea-step23-20260905/`
- OMNIA-LIT-001 v1.0: `audit/omnia-lit-001/v1.0/`
- Frozen v1.1 contract/oracle: `audit/omnia-lit-001/v1.1/`
- r2 candidate/static evidence: `audit/omnia-lit-001/v1.1-r2/`
- Unverified external review: `audit/external-review/`
- Redundant 19-file audit archive: `audit/archive/audit-primary/`
- Complete 52-file generated-artifact inventory: `audit/archive/all-generated-manifest.json`
- Machine-readable final status: `audit/FINAL_PUBLICATION_STATE.json`

## Exact r2 candidate

The authoritative transport for the r2 candidate is:

`audit/omnia-lit-001/v1.1-r2/exact-patch-gzip-base64/`

Expected exact patch:

- bytes: `84637`
- SHA-256: `594bab835d3f0a909efd70a312992ca5a3a666025309a5128e20cabc57697c47`
- frozen patch base: `f5995536fede02d403f0525ff9093996457efecb`

The earlier `patch-parts/` experiment is deliberately retained but marked non-authoritative because transfer-byte drift was detected. External auditors should not reconstruct the candidate from that path.

## Redundant audit-primary archive reconstruction

From `audit/archive/audit-primary/`:

```bash
python3 verify.py
```

Expected archive identity:

- 8 transport chunks
- base64 stream: 74,844 bytes
- gzip archive: 56,131 bytes
- gzip SHA-256: `896ab99289a2fd508713d71bdc101d4908d38eba20b284f4e278b133cc6d4682`
- uncompressed tar SHA-256: `79a050640a2d681bceddd7a0a11f1e502a21e87629644fb52c7c7f08b148e46a`
- 19 contained primary files, each checked against `manifest.json`

The archive is redundant. Readable repository evidence and the exact r2 candidate path remain the primary audit surfaces.

## Complete generated-artifact inventory

`audit/archive/all-generated-manifest.json` enumerates **all 52 generated deliverable files from this workflow**, excluding only transient `__pycache__` and `.pyc` files. Every entry records exact byte size and SHA-256.

A larger deterministic packaging wrapper was also generated during the workflow and is recorded for provenance:

- gzip bytes: `154913`
- gzip SHA-256: `b83eddd76669580948697b870ea8cf324e1ba079b9a2c281e8386cd5a8c62401`
- uncompressed tar SHA-256: `e715e3c0412dcd7d2fe90f9a645ec922eb1538f043a610772fbaf2e0196a068c`

That wrapper is deliberately **not authoritative and not separately transported**. Publishing nested packaging copies would create recursive archive-of-archive deliverables without adding evidence. Its unique substantive constituents are already available through readable audit paths, the reconstructible 19-file audit-primary archive, or the exact r2 patch. The 52-file manifest is the completeness ledger for generated outputs.

## Frozen high-level artifact identities

- semantic core: `230a6a1e5de6bcd73a96a96aaafbe9f564c3f68fdc5eea18056740fcd56375f8`
- source registry: `d90db5c04e130434d8f0be7e6c4ee1d8e6d433b6994d3ac2946f5524f75ab23d`
- Master Plan: `c8d9a6214f9ed5b0ecc6cd03cde7e5becbd2292181ae8e041a06087ad4d61798`
- decisions map: `3802cd728279fc3596d5c5efc71ed0c76e92ac40a774a8656582ef61dd5b0a33`
- acceptance plan: `df476e946ad16a8e4ea6fbdf25b4e63ae9f1d625dd732c3960f29444d0430ff9`
- derivation: `b7189328ab3c73f2617b21d0c629b565f2d93a00c95868a17f6b57297f9fcda6`
- independent review: `4ac14acd5745f9c3b933a90b2513db1eee974ad86ac2f307ba20e68a579ca096`
- v1.1 contract: `87260bb3182f80ddac1e95c0119f523673c597c9f1bd8fa5f2905d5079ab842b`
- Python reference oracle: `d067ed3fb6be3bde396aa155ccd7da20008084d5964ecc9ec37fe5108193ca8b`
- frozen golden vectors: `52d9010b42ce5a8563574365338f485c1f38e76b6c4b425f5681c8149906a89b`
- r2 candidate patch: `594bab835d3f0a909efd70a312992ca5a3a666025309a5128e20cabc57697c47`

## Audit interpretation boundary

`source_observed` establishes inspected source structure, not executed correctness. `documentation_claim` remains documentation. `proposed_not_implemented` remains proposal. Static checks establish static properties only.

All physical acceptance cases remain:

`LIT-01..LIT-12 = NOT_EXECUTED`

The next admissible qualification evidence is the physical local Rust/SQLite execution handoff: build identity, linked SQLite/VFS identity, golden-vector comparison, concurrent CAS/replay results, SIGKILL recovery traces, negative-control results, and the resulting gate table.
