# Rhea / Omnia external audit chain

Branch: `audit/rhea-step23-omnia-lit-001-v1.1-r2`
Base: `f5995536fede02d403f0525ff9093996457efecb`

This branch is an audit publication branch, not a product merge branch. It preserves the architecture/evidence chain and the first Omnia local intact-transition candidate while keeping all runtime qualification claims explicit.

Commit lineage on this branch records:
1. provenance/index freeze;
2. STEP1 extraction protocol;
3. STEP2/3 semantic core and source registry;
4. decisions/acceptance/derivation;
5. master-plan synthesis and independent review;
6. frozen v1.1 byte-level contract and independent Python oracle;
7. user-supplied external audit input (unverified interpretation);
8. r2 candidate repairs and static evidence;
9. physical execution boundary.

Current invariant: `LIT-01..LIT-12 = NOT_EXECUTED` until a physical local Rust/SQLite execution handoff is committed. Static checks and oracle generation are not runtime acceptance.
