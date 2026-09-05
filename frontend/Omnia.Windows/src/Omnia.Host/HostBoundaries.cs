using Omnia.Contracts;

namespace Omnia.Host;

public interface IHostState
{
    Task<HostSnapshot> ReadAsync(CancellationToken cancellationToken);
}

public sealed record PolicyDecision(bool Allowed, string Reason);
public interface IHostPolicy
{
    PolicyDecision InspectMutation(ProductModule module);
}
public sealed class FrozenHostPolicy : IHostPolicy
{
    public PolicyDecision InspectMutation(ProductModule module) => new(false,
        "Execution is disabled. Host policy, state and physical receipt gates are not connected.");
}

public sealed record ProposalSubmission(bool Accepted, string Message);
public interface IProposalIntake
{
    Task<ProposalSubmission> RequestReviewAsync(ProposalRequest request, CancellationToken cancellationToken);
}
public sealed class DisabledProposalIntake : IProposalIntake
{
    public Task<ProposalSubmission> RequestReviewAsync(ProposalRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ContractJson.Validate(request.Proposal);
        return Task.FromResult(new ProposalSubmission(false,
            "Draft prepared in memory. Host proposal intake is unavailable; nothing was submitted."));
    }
}

public interface IReceiptVerifier
{
    ReceiptVerdict Verify(ExecutionReceipt receipt);
}
public sealed class UnavailableReceiptVerifier : IReceiptVerifier
{
    public ReceiptVerdict Verify(ExecutionReceipt receipt) => ReceiptVerdict.Unavailable;
}

public sealed record ReceiptAssessment(ReceiptVerdict Verdict, string Text);
public static class ReceiptAssessmentService
{
    public static ReceiptAssessment Assess(OperationProjection operation, IReceiptVerifier verifier,
        DateTimeOffset now, TimeSpan maximumAge)
    {
        if (operation.Receipt is not { } receipt)
            return new(ReceiptVerdict.Unavailable, "No execution receipt; outcome is unverified.");
        if (receipt.OperationId != operation.OperationId ||
            operation.ExpectedHead.Value != receipt.ExpectedHead ||
            operation.Status.Value != receipt.Outcome || receipt.RecordedAt > now)
            return new(ReceiptVerdict.Invalid, "Receipt does not match this operation, head, outcome or time.");
        if (operation.Status.StateAt(now, maximumAge) != Availability.Known ||
            operation.ExpectedHead.StateAt(now, maximumAge) != Availability.Known)
            return new(ReceiptVerdict.Unverified, "Operation observation is stale or unknown; receipt is unverified.");
        var verdict = verifier.Verify(receipt);
        return new(verdict, verdict == ReceiptVerdict.Verified
            ? $"Host receipt verified: {receipt.Outcome}."
            : $"Host reports {receipt.Outcome}; receipt verification is {verdict.ToString().ToLowerInvariant()}.");
    }
}

public static class ProposalDrafts
{
    public static ProposalRequest Prepare(MaintenanceCandidate candidate)
    {
        ContractJson.Validate(candidate);
        // This identifier correlates an ephemeral request, not a state revision or receipt.
        return new(Guid.NewGuid().ToString("D"), candidate.Proposal, candidate.ExpectedHead, candidate.ResolvedItemId);
    }
}
