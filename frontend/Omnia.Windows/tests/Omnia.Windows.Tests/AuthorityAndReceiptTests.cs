using Omnia.Contracts;
using Omnia.Host;
using Xunit;

namespace Omnia.Windows.Tests;

public sealed class AuthorityAndReceiptTests
{
    [Theory]
    [InlineData(ProductModule.SystemCleanup)][InlineData(ProductModule.FileCachesOrganizer)]
    [InlineData(ProductModule.AppManager)][InlineData(ProductModule.DataPropagator)]
    public void EveryModuleHasMutationDisabled(ProductModule module) => Assert.False(new FrozenHostPolicy().InspectMutation(module).Allowed);

    [Fact]
    public async Task DraftCannotBecomeSubmissionOrAdvanceAHead()
    {
        var candidate = Fixtures.Snapshot().Candidates[0];
        var request = ProposalDrafts.Prepare(candidate);
        var result = await new DisabledProposalIntake().RequestReviewAsync(request, CancellationToken.None);
        Assert.False(result.Accepted);
        Assert.True(request.DryRun);
        Assert.Same(candidate.ExpectedHead, request.ExpectedHead);
        Assert.Equal(Availability.Unavailable, request.ExpectedHead.State);
        Assert.Equal(ProposalAuthority.ProposalOnly, request.Proposal.Effect.Authority);
    }

    [Fact]
    public void HostSuccessWithReceiptIsStillUnverifiedByDefault()
    {
        var assessment = Assess(Fixtures.Snapshot().Operations[0], new UnavailableReceiptVerifier());
        Assert.Equal(ReceiptVerdict.Unavailable, assessment.Verdict);
        Assert.Contains("Host reports Succeeded", assessment.Text);
    }

    [Fact]
    public void MissingReceiptCannotBeVerified()
    {
        var operation = Fixtures.Snapshot().Operations[0] with { Receipt = null };
        Assert.Equal(ReceiptVerdict.Unavailable, Assess(operation, new AcceptingTestVerifier()).Verdict);
    }

    [Theory]
    [InlineData("operation")][InlineData("head")][InlineData("outcome")][InlineData("future")]
    public void RejectsReceiptSubstitutionBeforeVerifier(string mismatch)
    {
        var op = Fixtures.Snapshot().Operations[0];
        var receipt = op.Receipt!;
        receipt = mismatch switch
        {
            "operation" => receipt with { OperationId = "different-operation" },
            "head" => receipt with { ExpectedHead = "different-head" },
            "outcome" => receipt with { Outcome = ReportedOperationStatus.Failed },
            _ => receipt with { RecordedAt = Fixtures.Now.AddDays(1) }
        };
        Assert.Equal(ReceiptVerdict.Invalid, Assess(op with { Receipt = receipt }, new AcceptingTestVerifier()).Verdict);
    }

    [Fact]
    public void VerifiedIsOnlyPossibleWithInjectedVerifierAndFreshMatchingReceipt()
    {
        var op = Fixtures.Snapshot().Operations[0];
        Assert.Equal(ReceiptVerdict.Verified, Assess(op, new AcceptingTestVerifier()).Verdict);
        Assert.Equal(ReceiptVerdict.Unverified, ReceiptAssessmentService.Assess(op, new AcceptingTestVerifier(), Fixtures.Now.AddHours(1), Fixtures.MaximumAge).Verdict);
    }

    private static ReceiptAssessment Assess(OperationProjection operation, IReceiptVerifier verifier) =>
        ReceiptAssessmentService.Assess(operation, verifier, Fixtures.Now, Fixtures.MaximumAge);
    private sealed class AcceptingTestVerifier : IReceiptVerifier
    {
        public ReceiptVerdict Verify(ExecutionReceipt receipt) => ReceiptVerdict.Verified;
    }
}
