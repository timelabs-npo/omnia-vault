using System.Text.Json;

namespace Omnia.Contracts;

public enum PlatformFamily { Darwin, Win32, Linux }
public enum MaintenanceIntent { DiscoverCleanupCandidate, AnalyzeDiskUsage, ObserveStartupItem, ObserveService, ObserveApplicationCache, ObserveBrowserCache }
public enum ProposalMode { Observe, ProposeReclaim, ProposeDisable, ProposeUpdate }
// There is deliberately no executable authority in this type.
public enum ProposalAuthority { ProposalOnly }
public enum TargetClass { Cache, Log, Temporary, StartupItem, Service, Application, BrowserProfile, FilesystemRegion }
public enum RiskLevel { Low, Medium, High, Critical }
public enum UserDataRisk { NoneKnown, Possible, Material, Unknown }
public enum EvidenceRequirement { SourceRuleProvenance, ResolvedTargetIdentity, FreshObservation, ScopeValidation, AgeValidation, PrivilegeValidation, RecoveryOrRecreatePath, IndependentPolicyDecision, ExecutionReceipt }

public sealed record ProposalSource
{
    public required string System { get; init; }
    public required string Revision { get; init; }
    public required string RuleId { get; init; }
}
public sealed record ProposalPlatform
{
    public required PlatformFamily Family { get; init; }
    public required string Adapter { get; init; }
    public string? VersionConstraint { get; init; }
}
public sealed record ProposalEffect
{
    public required ProposalMode Mode { get; init; }
    // Describes a proposed effect; never grants permission to perform it.
    public required bool Destructive { get; init; }
    public required ProposalAuthority Authority { get; init; }
}
public sealed record ProposalTarget
{
    public required TargetClass Class { get; init; }
    public required string Locator { get; init; }
    public string? DisplayName { get; init; }
    public string? ItemId { get; init; }
}
public sealed record ProposalRisk
{
    public required RiskLevel Level { get; init; }
    public required bool RequiresElevation { get; init; }
    public required UserDataRisk UserDataRisk { get; init; }
}
public sealed record ProposalPreconditions
{
    public int? MinAgeDays { get; init; }
    public bool? DeepRecencyCheck { get; init; }
    public bool? MustBeWithinScope { get; init; }
    public bool? RequiresRestoreEvidence { get; init; }
}
public sealed record MaintenanceProposal
{
    public required string SchemaVersion { get; init; }
    public required string ProposalId { get; init; }
    public required ProposalSource Source { get; init; }
    public required ProposalPlatform Platform { get; init; }
    public required MaintenanceIntent Intent { get; init; }
    public required ProposalEffect Effect { get; init; }
    public required ProposalTarget Target { get; init; }
    public required ProposalRisk Risk { get; init; }
    public required ProposalPreconditions Preconditions { get; init; }
    public required IReadOnlyList<EvidenceRequirement> EvidenceRequirements { get; init; }
    // Optional playbook metadata is inert JSON. It is never interpreted as an action.
    public JsonElement? Metadata { get; init; }
}
