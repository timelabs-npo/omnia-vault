using Microsoft.UI.Xaml;
using Omnia.Host;

namespace Omnia.Windows;

public partial class App : Application
{
    private MainWindow? window;
    private HttpClient? client;
    public App() => InitializeComponent();
    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var configuration = EndpointConfiguration.Parse(Environment.GetEnvironmentVariable("OMNIA_PROJECTION_ENDPOINT"));
        client = HttpHostState.CreateClient();
        window = new MainWindow(new HttpHostState(client, configuration), new FrozenHostPolicy(),
            new DisabledProposalIntake(), new UnavailableReceiptVerifier(), configuration);
        window.Closed += (_, _) => client.Dispose();
        window.Activate();
    }
}
