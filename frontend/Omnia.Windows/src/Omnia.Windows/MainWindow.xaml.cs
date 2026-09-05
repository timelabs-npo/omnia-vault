using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Omnia.Contracts;
using Omnia.Host;

namespace Omnia.Windows;

public sealed partial class MainWindow : Window
{
    private readonly IHostState host;
    private readonly IHostPolicy policy;
    private readonly IProposalIntake intake;
    private readonly IReceiptVerifier verifier;
    private readonly EndpointConfiguration configuration;
    private readonly CancellationTokenSource lifetime = new();
    private readonly DispatcherTimer ageTimer = new() { Interval = TimeSpan.FromSeconds(15) };
    private HostSnapshot snapshot = HostSnapshot.Unavailable("Refresh to request a host observation.");
    private KuduCatalogResult? catalog;
    private string selected = "SystemCleanup";
    private bool initialized;
    private bool refreshing;
    private bool dialogOpen;

    public MainWindow(IHostState host, IHostPolicy policy, IProposalIntake intake,
        IReceiptVerifier verifier, EndpointConfiguration configuration)
    {
        this.host = host; this.policy = policy; this.intake = intake;
        this.verifier = verifier; this.configuration = configuration;
        InitializeComponent();
        SystemBackdrop = new MicaBackdrop();
        AppWindow.Resize(new global::Windows.Graphics.SizeInt32(1240, 880));
        initialized = true;
        Navigation.SelectedItem = Navigation.MenuItems[0];
        ageTimer.Tick += (_, _) => Render();
        ageTimer.Start();
        Closed += (_, _) => { ageTimer.Stop(); lifetime.Cancel(); };
        Render();
    }

    private void Navigate(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (!initialized || args.SelectedItem is not NavigationViewItem item) return;
        selected = item.Tag.ToString()!;
        Render();
    }

    private async void RefreshHost(object sender, RoutedEventArgs args)
    {
        if (refreshing) return;
        refreshing = true; RefreshButton.IsEnabled = false; CatalogButton.IsEnabled = false; Busy.IsActive = true;
        catalog = null;
        try { snapshot = await host.ReadAsync(lifetime.Token); }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { return; }
        finally { refreshing = false; RefreshButton.IsEnabled = true; CatalogButton.IsEnabled = true; Busy.IsActive = false; }
        Render();
    }

    private void ShowCatalog(object sender, RoutedEventArgs args)
    {
        catalog = KuduDiscovery.LoadWindowsCatalog();
        Navigation.SelectedItem = Navigation.MenuItems[0];
        Render();
    }

    private void Render()
    {
        if (!initialized) return;
        var now = DateTimeOffset.UtcNow;
        var effective = ProjectionPresentation.WithEffectiveFreshness(snapshot, now, configuration.MaximumAge);
        var operations = selected == "Operations";
        var module = operations ? ProductModule.SystemCleanup : Enum.Parse<ProductModule>(selected);
        (PageTitle.Text, PageDescription.Text, MutationButton.Content) = selected switch
        {
            "SystemCleanup" => ("System Cleanup", "Review maintenance candidates, their provenance and the evidence still required.", "Execute cleanup"),
            "FileCachesOrganizer" => ("File & Caches Organizer", "Inspect host observations of files and caches. Sizes and identities remain explicit when unknown.", "Organize files"),
            "AppManager" => ("App Manager", "Review application, startup and service observations supplied by the host.", "Modify applications"),
            "DataPropagator" => ("Data Propagator", "Review host propagation observations and operation receipts. Native CFAPI effects are deferred.", "Propagate data"),
            _ => ("Operations / Receipts", "Transport responses and requested actions are not proof of an executed effect.", "Execute operation")
        };
        // This slice has no mutation handler, even if a replacement policy reports Allowed.
        MutationButton.IsEnabled = false;
        ToolTipService.SetToolTip(MutationButton, policy.InspectMutation(module).Reason);
        var catalogView = catalog is not null && selected == "SystemCleanup";
        StateBanner.Title = catalogView ? "Omnia maintenance library" : $"Observations {snapshot.StateAt(now, configuration.MaximumAge).ToString().ToLowerInvariant()}";
        StateBanner.Message = catalogView
            ? "Review available maintenance checks. Device size, age and item identity have not been observed."
            : $"{snapshot.Detail ?? configuration.Status} Observed: {snapshot.ObservedAt?.ToString("u") ?? "unknown"}.";
        var candidates = catalogView ? catalog!.Candidates : effective.Candidates.Where(c => c.Module == module).ToArray();
        CatalogExclusions.Visibility = catalogView ? Visibility.Visible : Visibility.Collapsed;
        ExclusionText.Text = catalogView ? string.Join("\n", catalog!.Rejections) : "";
        Candidates.Visibility = operations ? Visibility.Collapsed : Visibility.Visible;
        Operations.Visibility = operations ? Visibility.Visible : Visibility.Collapsed;
        Candidates.ItemsSource = operations ? null : candidates.Select(c => new CandidateRow(c, now, configuration.MaximumAge)).ToArray();
        Operations.ItemsSource = operations ? effective.Operations.Select(o => new OperationRow(o, verifier, now, configuration.MaximumAge)).ToArray() : null;
        PageStatus.Text = catalogView
            ? $"{catalog!.Candidates.Count} maintenance checks available for review · {catalog.Rejections.Count} unavailable. No device scan has been performed."
            : operations
                ? snapshot.Operations.Count == 0 ? ProjectionPresentation.EmptyMessage(snapshot, now, configuration.MaximumAge, "Operations") : "Receipt verification uses the injected host verifier."
                : candidates.Count == 0 ? ProjectionPresentation.EmptyMessage(snapshot, now, configuration.MaximumAge, "Candidates") : "Review proposals · no storage has been reclaimed.";
    }

    private async void PrepareProposal(object sender, RoutedEventArgs args)
    {
        if (dialogOpen || sender is not Button { Tag: MaintenanceCandidate candidate }) return;
        dialogOpen = true;
        try
        {
            var request = ProposalDrafts.Prepare(candidate);
            var result = await intake.RequestReviewAsync(request, lifetime.Token);
            var details = new StackPanel { Spacing = 12 };
            details.Children.Add(new TextBlock { Text = result.Message, TextWrapping = TextWrapping.Wrap });
            details.Children.Add(new TextBlock { Text = candidate.Proposal.Target.DisplayName ?? "Maintenance review", FontSize = 20, TextWrapping = TextWrapping.Wrap });
            details.Children.Add(new TextBlock { Text = candidate.Proposal.Target.Locator, TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true });
            details.Children.Add(new TextBlock { Text = $"Estimated size: {ProjectionPresentation.Measure(candidate.SizeBytes, "bytes", DateTimeOffset.UtcNow, configuration.MaximumAge)}\nRisk: {candidate.Proposal.Risk.Level}\nAdministrator access required: {(candidate.Proposal.Risk.RequiresElevation ? "Yes" : "No")}\nItem identity: {request.ResolvedItemId.State}\nState observation: {request.ExpectedHead.State}", TextWrapping = TextWrapping.Wrap });
            details.Children.Add(new TextBlock { Text = "Before any change, Omnia requires verified item identity, scope, age, recovery evidence and an independent policy decision. Preparing this proposal does not authorize a change.", TextWrapping = TextWrapping.Wrap });
            details.Children.Add(new TextBlock { Text = $"Review reference: {request.OperationId}", TextWrapping = TextWrapping.Wrap, IsTextSelectionEnabled = true });
            await new ContentDialog { Title = "Review maintenance proposal", Content = details, CloseButtonText = "Close",
                XamlRoot = Content.XamlRoot }.ShowAsync();
        }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested) { }
        finally { dialogOpen = false; }
    }
}

public sealed class CandidateRow(MaintenanceCandidate candidate, DateTimeOffset now, TimeSpan maximumAge)
{
    public MaintenanceCandidate Candidate { get; } = candidate;
    public string Name => Candidate.Proposal.Target.DisplayName ?? "Maintenance candidate";
    public string Locator => Candidate.Proposal.Target.Locator;
    public string Measurements => $"Size: {ProjectionPresentation.Measure(Candidate.SizeBytes, "bytes", now, maximumAge)} · Age: {ProjectionPresentation.Measure(Candidate.AgeDays, "days", now, maximumAge)}";
    public string Risk => $"Risk: {Candidate.Proposal.Risk.Level} · User data risk: {Candidate.Proposal.Risk.UserDataRisk} · Administrator access: {(Candidate.Proposal.Risk.RequiresElevation ? "Required" : "Not required")} · Review only";
    public string Identity => $"Item: {ProjectionPresentation.Identity(Candidate.ResolvedItemId, now, maximumAge)}\nExpected head: {ProjectionPresentation.Identity(Candidate.ExpectedHead, now, maximumAge)}";
    public string Provenance => $"Maintenance definition revision: {Candidate.Proposal.Source.Revision}\nCheck reference: {Candidate.Proposal.Source.RuleId}";
}

public sealed class OperationRow(OperationProjection operation, IReceiptVerifier verifier, DateTimeOffset now, TimeSpan maximumAge)
{
    public string Description => operation.Description;
    public string Status => $"Host status: {operation.Status.StateAt(now, maximumAge)} · Reported outcome: {operation.Status.Value?.ToString() ?? "unknown"}";
    public string Assessment => ReceiptAssessmentService.Assess(operation, verifier, now, maximumAge).Text;
    public string Evidence => $"Operation: {operation.OperationId}\nExpected head: {ProjectionPresentation.Identity(operation.ExpectedHead, now, maximumAge)}\n" +
        (operation.Receipt is { } receipt ? $"Receipt: {receipt.ReceiptId}\nIssuer: {receipt.Issuer}\nResulting head: {receipt.ResultingHead}\nRecorded: {receipt.RecordedAt:u}\nEvidence digest: {receipt.EvidenceDigest}\nFailure class: {receipt.FailureClass ?? "not reported"}" : "Receipt: unavailable");
}
