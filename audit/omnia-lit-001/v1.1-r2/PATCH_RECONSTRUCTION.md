# r2 patch reconstruction

The exact candidate patch is stored in numbered UTF-8 parts under `patch-parts/` because the external audit publication path uses text-only GitHub API writes.

Reconstruct with:

```bash
cat audit/omnia-lit-001/v1.1-r2/patch-parts/part-* > /tmp/OMNIA-LIT-001-v1.1-r2.patch
shasum -a 256 /tmp/OMNIA-LIT-001-v1.1-r2.patch
```

Expected SHA-256:

`594bab835d3f0a909efd70a312992ca5a3a666025309a5128e20cabc57697c47`

Expected byte length: `84637`.

Apply only to the frozen baseline `f5995536fede02d403f0525ff9093996457efecb` in an isolated worktree. The v1.1 contract/oracle/golden identities are immutable and all LIT runtime gates remain NOT_EXECUTED until physical local evidence exists.
