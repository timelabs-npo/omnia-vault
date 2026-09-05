using System.Text.Json;
using System.Text.Json.Nodes;
using Omnia.Contracts;
using Xunit;

namespace Omnia.Windows.Tests;

public sealed class DecodingTests
{
    [Fact]
    public void DecodesTheUnmodifiedCompanionFixture()
    {
        var proposal = ContractJson.Decode<MaintenanceProposal>(Fixtures.Read("playbook/maintenance-proposal.valid.json"));
        Assert.Equal(PlatformFamily.Darwin, proposal.Platform.Family);
        Assert.Equal(MaintenanceIntent.ObserveBrowserCache, proposal.Intent);
        Assert.Equal(ProposalAuthority.ProposalOnly, proposal.Effect.Authority);
        Assert.Equal(7, proposal.Preconditions.MinAgeDays);
    }

    [Fact]
    public void RejectsCompanionAuthorityEscalationFixture() => Assert.Throws<JsonException>(() =>
        ContractJson.Decode<MaintenanceProposal>(Fixtures.Read("playbook/maintenance-proposal.authority.invalid.json")));

    [Theory]
    [InlineData("authority", "execute_now")]
    [InlineData("authority", "PROPOSAL_ONLY")]
    [InlineData("mode", "delete")]
    public void RejectsEscalationAndNonCanonicalEnums(string property, string value)
    {
        var json = Fixtures.Json("playbook/maintenance-proposal.valid.json");
        json["effect"]![property] = value;
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
    }

    [Theory]
    [InlineData("source")][InlineData("effect")][InlineData("preconditions")][InlineData("evidence_requirements")]
    public void RejectsMissingOrNullRequiredObject(string property)
    {
        var json = Fixtures.Json("playbook/maintenance-proposal.valid.json");
        json.Remove(property);
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
        json[property] = null;
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
    }

    [Fact]
    public void RejectsNumericEnumAndUnknownActionMembers()
    {
        var json = Fixtures.Json("playbook/maintenance-proposal.valid.json");
        json["effect"]!["authority"] = 0;
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
        json["effect"]!["authority"] = "proposal_only";
        json["target"]!["shell"] = "some executable action";
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
    }

    [Fact]
    public void RejectsDuplicateKeysBeforeDecoding()
    {
        var json = Fixtures.Read("playbook/maintenance-proposal.valid.json")
            .Replace("\"authority\": \"proposal_only\"", "\"authority\": \"execute_now\", \"authority\": \"proposal_only\"");
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json));
    }

    [Fact]
    public void RejectsMissingDestructiveBooleanInsteadOfDefaultingToFalse()
    {
        var json = Fixtures.Json("playbook/maintenance-proposal.valid.json");
        json["effect"]!.AsObject().Remove("destructive");
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
    }

    [Fact]
    public void RejectsInvalidAgeAndDuplicateEvidence()
    {
        var json = Fixtures.Json("playbook/maintenance-proposal.valid.json");
        json["preconditions"]!["min_age_days"] = -1;
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
        json["preconditions"]!["min_age_days"] = 3651;
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
        json["preconditions"]!["min_age_days"] = 0;
        json["evidence_requirements"] = new JsonArray("execution_receipt", "execution_receipt");
        Assert.Throws<JsonException>(() => ContractJson.Decode<MaintenanceProposal>(json.ToJsonString()));
    }

    [Fact]
    public void DestructiveDescriptionRemainsProposalOnlyOnRoundTrip()
    {
        var json = Fixtures.Json("playbook/maintenance-proposal.valid.json");
        json["effect"]!["destructive"] = true;
        var proposal = ContractJson.Decode<MaintenanceProposal>(json.ToJsonString());
        var roundTrip = ContractJson.Decode<MaintenanceProposal>(ContractJson.Encode(proposal));
        Assert.True(roundTrip.Effect.Destructive);
        Assert.Equal(ProposalAuthority.ProposalOnly, roundTrip.Effect.Authority);
    }

    [Fact]
    public void RejectsUndefinedAuthorityConstructedInProcess()
    {
        var p = Fixtures.Snapshot().Candidates[0].Proposal;
        Assert.Throws<JsonException>(() => ContractJson.Encode(p with { Effect = p.Effect with { Authority = (ProposalAuthority)99 } }));
    }

    [Fact]
    public void RejectsDuplicateCandidateIdentityAndUnsupportedTransportVersion()
    {
        var json = Fixtures.Json("host.snapshot.json");
        json["candidates"]!.AsArray().Add(json["candidates"]![0]!.DeepClone());
        Assert.Throws<JsonException>(() => ContractJson.Decode<HostSnapshot>(json.ToJsonString()));
        json = Fixtures.Json("host.snapshot.json");
        json["schema_version"] = "omnia-windows-projection/v2";
        Assert.Throws<JsonException>(() => ContractJson.Decode<HostSnapshot>(json.ToJsonString()));
    }
}
