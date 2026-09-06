# Attribution capture

`components.json` records declared authors, original copyright holders, exact
resolved versions, uses, source URLs and notice references. It covers embedded
Omnia/maintenance/semantic source, the full NuGet app/test dependency graphs,
the pinned self-contained .NET runtime, the schema validator's Python environment,
the installed .NET build toolchain, and GitHub Actions referenced by this workflow.

All original license, third-party notice, author and copyright files found in the
resolved packages are retained byte-for-byte under `../licenses/`. This includes
copyright holders of dependencies embedded within those packages, not only their
top-level publisher. Identical files share a content-addressed copy. NuGet `.nuspec`
metadata is also retained so author lists and source repository pins are inspectable.
Git attributes protect these files from platform line-ending conversion.

Author fields are preserved as published, including handles and contributor groups.
They do not assert exclusive authorship. Contributors without individual names in
upstream metadata remain covered by the upstream contributor/copyright notices;
no identities have been guessed. Full legal attribution is preserved even when a
neutral product label is used in the app.

The inventory conservatively includes restored Windows App SDK components even
when this host does not call their APIs. Test, build, validator and CI entries are
identified separately; their presence is not an application feature claim.

`tools/refresh_attributions.py` reads resolved package metadata and original package
files. Where a package only declares a license expression/URL, the capture retains
the declared metadata and downloads the original publisher's notice plus the full
license text where appropriate. The old `xunit.abstractions` metadata points at a
now-moved unversioned xUnit license; the pinned xUnit v2 family notice is retained
alongside that metadata. GitHub Actions source revisions are resolved and recorded
at capture time; they are CI services, not redistributed app code.

`tests/verify_semantics.py` independently checks all captured notice hashes,
required authors/notices, and coverage of the committed app/test NuGet lock files.
Dependency changes require a reviewed refresh of this inventory. The final archive
includes the original notices in its `Licenses` folder and this inventory.
