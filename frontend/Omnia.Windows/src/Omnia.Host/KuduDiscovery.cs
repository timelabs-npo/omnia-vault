using System.Text.Json;
using System.Text.Json.Serialization;
using Omnia.Contracts;

namespace Omnia.Host;

// A deliberately bounded adapter for upstream definitions/CleanTarget.
// Paths remain opaque templates; this library does not enumerate or resolve files.
public sealed record KuduCleanTarget
{
    public required string Path { get; init; }
    public required string Subcategory { get; init; }
    public bool? NeedsAdmin { get; init; }
    public bool? DeepRecencyCheck { get; init; }
    public bool? CacheReset { get; init; }
    public string? Description { get; init; }
    public string? CleanupAction { get; init; }
    public string? ChildSubdir { get; init; }
}
public sealed record KuduRuleResult(MaintenanceCandidate? Candidate, string? Rejection);
public sealed record KuduCatalogResult(IReadOnlyList<MaintenanceCandidate> Candidates, IReadOnlyList<string> Rejections);

public static class KuduDiscovery
{
    public const string UpstreamRevision = "92dbc52336ad9c9eb2968a180d22c72670de3b45";
    public const string PlaybookRevision = "35c21e2a56310870090ef927f8f7bfadfcc761aa";

    public static KuduCleanTarget DecodeRule(string json)
    {
        // Convert only naming policy; retain strict members, duplicate detection and enum handling.
        using var document = JsonDocument.Parse(json);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in document.RootElement.EnumerateObject())
            if (!seen.Add(property.Name)) throw new JsonException("Duplicate Kudu property.");
        var options = ContractJson.CreateOptions();
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        var rule = JsonSerializer.Deserialize<KuduCleanTarget>(json, options) ?? throw new JsonException("Null rule.");
        ContractJson.Validate(rule);
        return rule;
    }

    public static KuduRuleResult Normalize(KuduCleanTarget rule, PlatformFamily family, string ruleId,
        string revision = UpstreamRevision)
    {
        ContractJson.Validate(rule);
        if (revision != UpstreamRevision) return new(null, "Upstream revision is not pinned; revalidation required.");
        if (rule.CleanupAction is not null) return new(null, "Executable cleanupAction is unsupported.");
        if (rule.ChildSubdir is not null) return new(null, "Child-directory discovery is not implemented.");
        if (rule.CacheReset == true) return new(null, "Performance cache resets are deferred.");
        if (rule.NeedsAdmin is null) return new(null, "Privilege metadata is missing; rule requires reconciliation.");
        var proposal = new MaintenanceProposal
        {
            SchemaVersion = "maintenance-proposal/v1", ProposalId = $"kudu-{family.ToString().ToLowerInvariant()}-{ruleId}",
            Source = new() { System = "AdventDevInc/kudu", Revision = revision, RuleId = ruleId },
            Platform = new() { Family = family, Adapter = $"omnia-maintenance-{family.ToString().ToLowerInvariant()}" },
            Intent = MaintenanceIntent.DiscoverCleanupCandidate,
            Effect = new() { Mode = ProposalMode.ProposeReclaim, Destructive = false, Authority = ProposalAuthority.ProposalOnly },
            Target = new() { Class = TargetClass.FilesystemRegion, Locator = rule.Path, DisplayName = rule.Subcategory },
            Risk = new() { Level = rule.NeedsAdmin.Value ? RiskLevel.High : RiskLevel.Medium, RequiresElevation = rule.NeedsAdmin.Value, UserDataRisk = UserDataRisk.Unknown },
            Preconditions = new() { DeepRecencyCheck = rule.DeepRecencyCheck, MustBeWithinScope = true, RequiresRestoreEvidence = true },
            EvidenceRequirements = [EvidenceRequirement.SourceRuleProvenance, EvidenceRequirement.ResolvedTargetIdentity,
                EvidenceRequirement.FreshObservation, EvidenceRequirement.ScopeValidation, EvidenceRequirement.AgeValidation,
                EvidenceRequirement.PrivilegeValidation, EvidenceRequirement.RecoveryOrRecreatePath,
                EvidenceRequirement.IndependentPolicyDecision, EvidenceRequirement.ExecutionReceipt]
        };
        ContractJson.Validate(proposal);
        return new(new MaintenanceCandidate
        {
            CandidateId = proposal.ProposalId, Module = ProductModule.SystemCleanup, Proposal = proposal,
            SizeBytes = new() { State = Availability.Unknown, Detail = "Rule descriptor; no disk observation." },
            AgeDays = new() { State = Availability.Unknown },
            ResolvedItemId = new() { State = Availability.Unknown },
            ExpectedHead = new() { State = Availability.Unavailable }
        }, null);
    }

    public static KuduCatalogResult LoadWindowsCatalog()
    {
        using var stream = typeof(KuduDiscovery).Assembly.GetManifestResourceStream("kudu.win32.system.json")
            ?? throw new InvalidOperationException("Bundled catalog missing.");
        using var document = JsonDocument.Parse(stream);
        var candidates = new List<MaintenanceCandidate>();
        var rejections = new List<string>();
        var index = 0;
        foreach (var element in document.RootElement.GetProperty("cleanTargets").EnumerateArray())
        {
            var id = $"system/cleanTargets/{index++}";
            var result = Normalize(DecodeRule(element.GetRawText()), PlatformFamily.Win32, id);
            if (result.Candidate is { } candidate) candidates.Add(candidate);
            else rejections.Add($"{id}: {result.Rejection}");
        }
        // Single-file targets have a different upstream contract and are not silently adapted.
        if (document.RootElement.TryGetProperty("singleFileTargets", out var singleFiles) && singleFiles.GetArrayLength() > 0)
            rejections.Add($"{singleFiles.GetArrayLength()} single-file rules are outside this adapter's scope.");
        return new(candidates.AsReadOnly(), rejections.AsReadOnly());
    }
}
