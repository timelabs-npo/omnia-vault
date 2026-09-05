"""Independent JSON Schema and provenance check; does not import C# implementation code."""
import hashlib
import json
from pathlib import Path

from jsonschema import Draft7Validator, Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    manifest = read(FIXTURES / "provenance.json")
    for entry in manifest["files"]:
        actual = hashlib.sha256((FIXTURES / entry["path"]).read_bytes()).hexdigest()
        assert actual == entry["sha256"], f"Provenance drift: {entry['path']}"

    schema = read(FIXTURES / "playbook/maintenance-proposal.schema.json")
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    validator.validate(read(FIXTURES / "playbook/maintenance-proposal.valid.json"))
    invalid = read(FIXTURES / "playbook/maintenance-proposal.authority.invalid.json")
    assert not validator.is_valid(invalid), "Negative authority control was accepted"
    kudu_validator = Draft7Validator(read(FIXTURES / "kudu/rules.schema.json"))
    for family in ("win32", "darwin", "linux"):
        kudu_validator.validate(read(FIXTURES / f"kudu/{family}.system.json"))
        validator.validate(read(FIXTURES / f"parity/{family}.proposal.json"))

    exported = ROOT / "tests/Omnia.Windows.Tests/bin/Release/net8.0/normalized-proposals.json"
    assert exported.is_file(), "Run dotnet test -c Release first; normalizer export is missing"
    proposals = read(exported)
    assert proposals, "Normalizer produced no proposals"
    expected = read(FIXTURES / "parity/expected-semantics.json")
    for proposal in proposals:
        validator.validate(proposal)
        assert proposal["effect"]["authority"] == "proposal_only"
        assert proposal["source"]["revision"] == manifest["kudu_revision"]
    # The last three exports are independently specified equivalent platform inputs.
    for proposal in proposals[-3:]:
        actual = {key: proposal[key] for key in ("intent", "effect", "risk", "preconditions", "evidence_requirements")}
        actual["target_class"] = proposal["target"]["class"]
        assert actual == expected, f"Platform semantic drift: {proposal['platform']}"
    print(f"PASS: {len(manifest['files'])} pinned source hashes; 3 Kudu catalogs; companion positive/negative controls; {len(proposals)} generated proposals; 3-platform semantic parity")


if __name__ == "__main__":
    main()
