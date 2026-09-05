# Windows evolution verification

Observed locally on 2026-09-06. These results qualify the Windows projection slice
only, not the frozen Omnia core or filesystem effects.

## Environment and build

- Windows x64, OS version reported by .NET: `10.0.26200`.
- Stable .NET SDK `8.0.318` selected by scoped `global.json`; the installed .NET 11
  preview was not used.
- Windows SDK Include version `10.0.26100.0` present.
- Visual Studio Community 2022 `17.14.38` and 2026 `18.9.0` present.
- Windows App SDK `2.4.0`, SDK BuildTools `10.0.26100.4654`, restored from NuGet.
- **No missing Windows SDK/tooling blocked this build.** No SDK/workload installation
  was required. An isolated Python dependency directory was used for JSON Schema validation.

`dotnet build src/Omnia.Windows/Omnia.Windows.csproj -c Release -p:Platform=x64 -m:1`
succeeded with **0 warnings / 0 errors**. The final Omnia-only branding revision was
also built successfully with an isolated output directory while the earlier preview
was open; **0 warnings / 0 errors**. That output is the basis for the delivered app.

Both app and test locked restores passed. The app is an unpackaged, self-contained
x64 build. It is not an MSIX package or a signed production release.

## Automated verification

`dotnet test tests/Omnia.Windows.Tests/Omnia.Windows.Tests.csproj -c Release`:
**74 passed, 0 failed, 0 skipped**. TRX results were produced.

The suite covers required/null/duplicate/unknown DTO fields, canonical enum decoding,
proposal authority and escalation rejection, required false booleans, evidence/age
constraints, duplicate identities, observed zero, unknown/unavailable/stale/empty,
future timestamps, stale envelope propagation, disabled policy/intake, head copying,
receipt substitution/matching/freshness and default unverified outcomes, endpoint
validation, GET-only requests, invalid responses, redacted network failures, response
limits, body-read deadlines and cancellation, plus parity and Kudu exclusions.

`python tests/verify_semantics.py` independently passed:

- **8 exact source-file hashes**, including the companion license;
- **3 full pinned upstream system catalogs** against the upstream Kudu schema;
- companion valid/invalid authority control fixtures;
- **41 actual C# generated proposals** against the companion schema;
- **3-platform semantic parity** against the independently authored oracle.

Source search found no filesystem deletion/write/move, process launch, shell,
registry mutation, P/Invoke or SQLite API in production app/host/contracts source.
This is a bounded source check, not a sandbox security proof.

## Native smoke check

The native executable launched successfully and exposed the five navigation items
in Windows UI Automation. The initial unavailable observation state and disabled
cleanup button were observed. The user stopped Computer Use with Escape when catalog
interaction was attempted. Desktop interaction stopped immediately.

Afterward the user requested Omnia-only product branding. That revision compiled;
its XAML and UI string surfaces were statically checked to exclude upstream branding.
The raw JSON proposal dialog was replaced with a readable review dialog.

**Not verified interactively:** final branding appearance, catalog expansion,
proposal dialog, all module transitions, keyboard/high-DPI behavior and a live
projection endpoint. No screenshot was published. The earlier preview may remain
open; use the final delivered executable for the updated surface.

## Publication and limits

The first GitHub runs passed native Windows compilation and Linux verification.
The Windows xUnit suite passed all 74 tests, but its independent provenance check
correctly failed when Git's automatic line-ending conversion changed a pinned
schema's bytes. Scoped `.gitattributes` now disables that conversion for pinned
upstream fixtures. No expected hash, schema or oracle was weakened or rewritten.

The repository includes Windows build and Windows/Linux contract CI jobs. The
post-fix run status must be read from GitHub; the workflow's presence is not a PASS.
The final delivery report records exact published commit IDs, changed files and
remote CI status separately so this file does not claim results ahead of execution.

No live host endpoint, native discovery service, authenticated receipt verifier,
proposal submission, destructive operation, CFAPI integration, ARM64 build, MSIX,
signing or installer was qualified. `LIT-01..12` remain outside this work and are
not promoted. The frozen core, audit history and existing product files are unchanged.
