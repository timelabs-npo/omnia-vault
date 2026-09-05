namespace Omnia.Contracts;

public enum Availability { Known, Unknown, Stale, Unavailable, Empty }
public enum ProductModule { SystemCleanup, FileCachesOrganizer, AppManager, DataPropagator }
public enum ReportedOperationStatus { Unknown, Requested, Running, Succeeded, Failed, Rejected }
public enum ReceiptVerdict { Verified, Unverified, Unavailable, Invalid }

public sealed record Observation<T>
{
    public required Availability State { get; init; }
    public T? Value { get; init; }
    public DateTimeOffset? ObservedAt { get; init; }
    public string? Detail { get; init; }

    public Availability StateAt(DateTimeOffset now, TimeSpan maximumAge) =>
        State == Availability.Known && (ObservedAt is null || ObservedAt > now || now - ObservedAt > maximumAge)
            ? Availability.Stale : State;
}

public sealed record MaintenanceCandidate
{
    public required string CandidateId { get; init; }
    public required ProductModule Module { get; init; }
    public required MaintenanceProposal Proposal { get; init; }
    public required Observation<long?> SizeBytes { get; init; }
    public required Observation<long?> AgeDays { get; init; }
    public required Observation<string> ResolvedItemId { get; init; }
    public required Observation<string> ExpectedHead { get; init; }
}

public sealed record ExecutionReceipt
{
    public required string ReceiptId { get; init; }
    public required string OperationId { get; init; }
    public required string Issuer { get; init; }
    public required string ExpectedHead { get; init; }
    public required string ResultingHead { get; init; }
    public required ReportedOperationStatus Outcome { get; init; }
    public required DateTimeOffset RecordedAt { get; init; }
    public required string EvidenceDigest { get; init; }
    public string? FailureClass { get; init; }
}

public sealed record OperationProjection
{
    public required string OperationId { get; init; }
    public required string Description { get; init; }
    public required Observation<ReportedOperationStatus?> Status { get; init; }
    public required Observation<string> ExpectedHead { get; init; }
    public ExecutionReceipt? Receipt { get; init; }
}

// A Windows projection transport contract, not the frozen core's state schema.
public sealed record HostSnapshot
{
    public required string SchemaVersion { get; init; }
    public required Availability State { get; init; }
    public DateTimeOffset? ObservedAt { get; init; }
    public string? Detail { get; init; }
    public required IReadOnlyList<MaintenanceCandidate> Candidates { get; init; }
    public required IReadOnlyList<OperationProjection> Operations { get; init; }

    public Availability StateAt(DateTimeOffset now, TimeSpan maximumAge) =>
        State is Availability.Known or Availability.Empty &&
        (ObservedAt is null || ObservedAt > now || now - ObservedAt > maximumAge) ? Availability.Stale : State;

    public static HostSnapshot Unavailable(string detail) => new()
    {
        SchemaVersion = "omnia-windows-projection/v1", State = Availability.Unavailable,
        Detail = detail, Candidates = [], Operations = []
    };
}

// Ephemeral review request: expected head is copied from a host observation, never advanced locally.
public sealed record ProposalRequest(string OperationId, MaintenanceProposal Proposal,
    Observation<string> ExpectedHead, Observation<string> ResolvedItemId, bool DryRun = true);
