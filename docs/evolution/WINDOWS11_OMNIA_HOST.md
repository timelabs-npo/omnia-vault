# Native Windows 11 Omnia evolution

Branch: `evolution/windows11-omnia-v1`; draft only, no merge to main.

Implementation and instructions: [frontend/Omnia.Windows](../../frontend/Omnia.Windows/README.md).
Authority architecture: [ARCHITECTURE.md](../../frontend/Omnia.Windows/ARCHITECTURE.md).
Observed verification: [VERIFICATION.md](../../frontend/Omnia.Windows/VERIFICATION.md).

Started from `evolution/kudu-omnia-v1` at
`ada2d783a3b688cb5352634d6202a45a5124273c`, rooted in frozen product baseline
`f5995536fede02d403f0525ff9093996457efecb`.
Companion semantic contract is `omnia-playbook/evolution/maintenance-semantic-redteam-v1`
at `35c21e2a56310870090ef927f8f7bfadfcc761aa`; Kudu remains pinned at
`92dbc52336ad9c9eb2968a180d22c72670de3b45`.

The WinUI 3 / Windows App SDK / C# host adds the requested five product views,
proposal-only Kudu system-rule compatibility, explicit observation states, and
receipt-backed operation projection interfaces. No existing core, audit artifact,
mutation route, or macOS product code is changed. No physical LIT gate is promoted.
