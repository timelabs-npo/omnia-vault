# Frozen v1.1 golden-vector identities

Generated independently by `reference_oracle.py`; no Rust implementation input.

- golden_vectors.json SHA-256: `52d9010b42ce5a8563574365338f485c1f38e76b6c4b425f5681c8149906a89b`
- empty_tree_id: `eef307e1688591bb1aed1ac864613665a3fa462262ba4157ab19d623c64e0718`
- genesis_revision_id: `129374fff1bd9a3f511449f0eb3aedee427d7f6bd314ea724ed195c38fa118a6`
- bootstrap_receipt_digest: `a90b5bdf7537f5441f44db70d431c88e0712488f56245d634c58fb5db38088ea`
- commit_receipt_digest: `a202f08c67e87567dd7824c309bfa93bc0eea394936e977d5d0e12b0b3f1a908`
- conflict_receipt_digest: `8a7b5fdcb63135433311197885bc420d496290d23ba0f7d119ca03a0b5979f84`
- canonical ordering test: item maps [1,2] and [2,1] yield tree id `97654540c254b45084027f084cbacfb59d0f0ea037e127cd3f1e2d59c01966d4`.

The full `golden_vectors.json` remains identified by the SHA above and is part of the local audit bundle; this commit freezes its externally relevant identities without claiming Rust execution.
