using System.Text.Json;
using System.Text.Json.Nodes;
using Omnia.Contracts;
using Omnia.Host;
using Xunit;

namespace Omnia.Windows.Tests;

public sealed class ParityTests
{
    [Theory]
    [InlineData("darwin", PlatformFamily.Darwin)][InlineData("win32", PlatformFamily.Win32)][InlineData("linux", PlatformFamily.Linux)]
    public void IndependentPlatformInputsMatchFrozenSemanticOracle(string name, PlatformFamily family)
    {
        var rule = KuduDiscovery.DecodeRule(Fixtures.Read($"parity/{name}.rule.json"));
        var candidate = KuduDiscovery.Normalize(rule, family, "system/cleanTargets/0").Candidate!;
        var actual = SemanticPart(candidate.Proposal);
        Assert.True(JsonNode.DeepEquals(Fixtures.Json("parity/expected-semantics.json"), actual), actual.ToJsonString());
        Assert.Equal(rule.Path, candidate.Proposal.Target.Locator);
        Assert.Equal(family, candidate.Proposal.Platform.Family);
        Assert.Equal(Availability.Unknown, candidate.SizeBytes.State);
        Assert.Null(candidate.Proposal.Target.ItemId);
    }

    [Fact]
    public void ParityComparatorDetectsChangedRiskEvidenceAndEffect()
    {
        var proposal = ContractJson.Decode<MaintenanceProposal>(Fixtures.Read("parity/win32.proposal.json"));
        var expected = Fixtures.Json("parity/expected-semantics.json");
        Assert.True(JsonNode.DeepEquals(expected, SemanticPart(proposal)));
        Assert.False(JsonNode.DeepEquals(expected, SemanticPart(proposal with { Risk = proposal.Risk with { RequiresElevation = true } })));
        Assert.False(JsonNode.DeepEquals(expected, SemanticPart(proposal with { Effect = proposal.Effect with { Mode = ProposalMode.ProposeDisable } })));
        Assert.False(JsonNode.DeepEquals(expected, SemanticPart(proposal with { EvidenceRequirements = [EvidenceRequirement.SourceRuleProvenance] })));
    }

    [Theory]
    [InlineData("cleanupAction")][InlineData("childSubdir")][InlineData("cacheReset")]
    public void UnsupportedKuduRulesAreExplicitlyExcluded(string field)
    {
        var json = Fixtures.Json("parity/win32.rule.json");
        if (field == "cacheReset") json[field] = true; else json[field] = "unsafe-or-unsupported";
        var result = KuduDiscovery.Normalize(KuduDiscovery.DecodeRule(json.ToJsonString()), PlatformFamily.Win32, "redteam/001");
        Assert.Null(result.Candidate);
        Assert.NotNull(result.Rejection);
    }

    [Fact]
    public void ElevationNeverAuthorizesAndChangedRevisionIsRejected()
    {
        var rule = KuduDiscovery.DecodeRule(Fixtures.Read("parity/win32.rule.json")) with { NeedsAdmin = true };
        var p = KuduDiscovery.Normalize(rule, PlatformFamily.Win32, "fixture/001").Candidate!.Proposal;
        Assert.True(p.Risk.RequiresElevation);
        Assert.Equal(ProposalAuthority.ProposalOnly, p.Effect.Authority);
        Assert.Null(KuduDiscovery.Normalize(rule, PlatformFamily.Win32, "fixture/001", "changed-revision").Candidate);
        Assert.Null(KuduDiscovery.Normalize(rule with { NeedsAdmin = null }, PlatformFamily.Win32, "fixture/001").Candidate);
    }

    [Fact]
    public void RealPinnedWindowsCatalogProducesUnknownDescriptorsAndExplicitRejections()
    {
        var catalog = KuduDiscovery.LoadWindowsCatalog();
        Assert.NotEmpty(catalog.Candidates);
        Assert.NotEmpty(catalog.Rejections);
        Assert.All(catalog.Candidates, c =>
        {
            Assert.Equal(ProposalAuthority.ProposalOnly, c.Proposal.Effect.Authority);
            Assert.Null(c.SizeBytes.Value);
            Assert.Equal(Availability.Unavailable, c.ExpectedHead.State);
            Assert.Equal(KuduDiscovery.UpstreamRevision, c.Proposal.Source.Revision);
        });
        Assert.Contains(catalog.Rejections, r => r.Contains("cleanupAction"));
    }

    [Fact]
    public void KuduUnknownActionAndDuplicateFieldsAreRejected()
    {
        Assert.Throws<JsonException>(() => KuduDiscovery.DecodeRule("{\"path\":\"x\",\"subcategory\":\"x\",\"shell\":\"execute\"}"));
        Assert.Throws<JsonException>(() => KuduDiscovery.DecodeRule("{\"path\":\"x\",\"path\":\"y\",\"subcategory\":\"x\"}"));
    }

    private static JsonObject SemanticPart(MaintenanceProposal proposal)
    {
        var json = JsonNode.Parse(ContractJson.Encode(proposal))!;
        return new JsonObject
        {
            ["intent"] = json["intent"]!.DeepClone(), ["effect"] = json["effect"]!.DeepClone(),
            ["target_class"] = json["target"]!["class"]!.DeepClone(), ["risk"] = json["risk"]!.DeepClone(),
            ["preconditions"] = json["preconditions"]!.DeepClone(), ["evidence_requirements"] = json["evidence_requirements"]!.DeepClone()
        };
    }
}
