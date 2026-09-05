# Omnia for Windows 11

A native C# / WinUI 3 projection and proposal host for Windows 11 Pro, x64.
This evolution slice adds no filesystem effects or state authority to the UI.

## What runs

- Native navigation for **System Cleanup**, **File & Caches Organizer**, **App Manager**,
  **Data Propagator**, and **Operations / Receipts**.
- Strict typed decoding of playbook maintenance proposals and the proposed Windows
  host projection transport. Unknown, unavailable, stale, empty and observed zero
  remain distinct; stale envelopes downgrade nested observations.
- A GET-only host projection reader with injected endpoint, explicit failures,
  response size/deadline limits, and no automatic redirects or credentials.
- An embedded, pinned Kudu Windows system-rule catalog. Supported rules become
  proposal descriptors with unknown size, age and resolved identity. **Catalog
  review is not a disk scan.** Unsupported actions and missing privilege metadata
  produce visible exclusions.
- In-memory proposal preparation and a disabled host intake. Receipt status is
  displayed as host-reported and unverified until a host verifier is supplied.

All mutation buttons are disabled and have no execution handlers. The shipped
policy always denies mutation, proposal intake never submits, and receipt verifier
returns unavailable. There is no shell, deletion, registry/service writer, Kudu
executor, SQLite store, alternate head, or persistent operation queue in this app.

## Source anchors

| Input | Exact revision |
|---|---|
| `omnia-vault/evolution/kudu-omnia-v1` | `ada2d783a3b688cb5352634d6202a45a5124273c` |
| Frozen Omnia product baseline | `f5995536fede02d403f0525ff9093996457efecb` |
| `omnia-playbook/evolution/maintenance-semantic-redteam-v1` | `35c21e2a56310870090ef927f8f7bfadfcc761aa` |
| `AdventDevInc/kudu` | `92dbc52336ad9c9eb2968a180d22c72670de3b45` |

Companion PRs: [Omnia #2](https://github.com/timelabs-npo/omnia-vault/pull/2),
[playbook #9](https://github.com/timelabs-npo/omnia-playbook/pull/9).
Fixture hashes and source paths are recorded in [fixtures/provenance.json](fixtures/provenance.json).
Parity rules and the host snapshot are **synthetic contract fixtures**, never device evidence.

## Build and run

Use Windows 11 x64, .NET SDK **8.0.3xx** (the local SDK used was 8.0.318), and Windows
SDK **10.0.26100.0**. Visual Studio 2022 17.10+ with WinUI development tools is useful
for interactive debugging; a full Visual Studio IDE is not needed for the commands
below when the SDK/XAML dependencies are installed. Run from this directory so that
`global.json` selects the stable .NET 8 SDK rather than an installed preview.

```powershell
dotnet restore src/Omnia.Windows/Omnia.Windows.csproj --locked-mode -p:Platform=x64
dotnet build src/Omnia.Windows/Omnia.Windows.csproj -c Release -p:Platform=x64 --no-restore -m:1
& ./src/Omnia.Windows/bin/x64/Release/net8.0-windows10.0.26100.0/win-x64/Omnia.Windows.exe
```

Windows App SDK **2.4.0** and Windows SDK BuildTools **10.0.26100.4654** are pinned
NuGet references with committed lock files. The unpackaged app is self-contained
for .NET and Windows App SDK; keep the entire output folder together. No elevation,
MSIX registration, production endpoint, or secret is required to open the app.
The deployment model follows Microsoft's
[unpackaged WinUI guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/unpackage-winui-app).

The app initially shows unavailable observations. Select **Review maintenance checks** for
offline descriptors, or configure a read-only host projection adapter before launch:

```powershell
$env:OMNIA_PROJECTION_ENDPOINT = 'http://127.0.0.1:4567/projection'
& ./src/Omnia.Windows/bin/x64/Release/net8.0-windows10.0.26100.0/win-x64/Omnia.Windows.exe
```

That address is a documentation example, not a default or an existing core route.
Use the adapter's full HTTPS endpoint, or HTTP only on loopback. URLs containing
userinfo, query strings or fragments are rejected. Authentication is intentionally
not implemented in this slice; inject an appropriately authenticated transport in
the composition root when a reviewed host authentication contract exists. Never
put credentials in source or URLs. Click **Refresh observations** to perform one GET.

The product surface uses Omnia branding only. Upstream identities and exact source
revisions remain in typed provenance and repository notices, not product names,
navigation, banners or raw JSON dialogs. Proposal review uses readable fields.

The adapter must serve `omnia-windows-projection/v1` JSON shaped like
[fixtures/host.snapshot.json](fixtures/host.snapshot.json), with real host-supplied
timestamps and evidence. Do not connect this reader to legacy cleanup endpoints.

## Verify

Contracts and host tests run without WinUI or a Windows SDK, including on Linux:

```powershell
dotnet restore tests/Omnia.Windows.Tests/Omnia.Windows.Tests.csproj --locked-mode
dotnet test tests/Omnia.Windows.Tests/Omnia.Windows.Tests.csproj -c Release --no-restore --logger 'trx;LogFileName=contracts.trx' -m:1
python -m pip install -r tests/requirements.txt
python tests/verify_semantics.py
```

The xUnit suite exports actual normalizer output into its Release output directory.
The independent Python validator uses the unmodified companion JSON Schema to check
that export, pinned source hashes, three upstream Kudu catalogs, negative authority
controls and independently specified parity expectations. It fails if the C# export
is absent. Run both checks, not only the schema fixture check.

See [VERIFICATION.md](VERIFICATION.md) for observed results and remaining manual checks,
and [ARCHITECTURE.md](ARCHITECTURE.md) for authority and integration contracts.

## Deliberate limits

- No real disk enumeration, environment/path expansion, reparse-point resolution,
  app/service inventory, age measurement or scope validation runs in the app.
  These observations belong to a future read-only host adapter.
- Kudu `CleanTarget` is the bounded source dialect. `cleanupAction`, `childSubdir`,
  performance cache resets, single-file rules and missing `needsAdmin` are excluded;
  broader app/browser/recursive catalogs are not implemented here.
- Organizer, App Manager and Data Propagator have native projection views and
  disabled effect surfaces. Their data requires an injected host. The playbook v1
  schema does not define propagation effects; no new propagation authority is invented.
- Receipt signature/digest verification, policy approval, durable submission,
  expected-head CAS, filesystem effects, CFAPI and recovery are not implemented.
- No frozen `OMNIA-LIT-001` gate is executed or promoted by app tests.
- x64 only. ARM64, MSIX, signing, installer distribution and release qualification
  remain future work.

## Notices

Omnia source remains under the repository MIT license. Kudu catalogs/schema are
MIT-licensed; see [Kudu's notice](../../third_party/kudu/LICENSE).
The copied playbook schema/fixtures are BSD-3-Clause; see
[fixtures/playbook/LICENSE](fixtures/playbook/LICENSE).
