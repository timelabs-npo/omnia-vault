using System.Net;
using System.Text;
using System.Text.Json;
using Omnia.Contracts;

namespace Omnia.Host;

public sealed record EndpointConfiguration
{
    public Uri? ProjectionEndpoint { get; }
    public TimeSpan MaximumAge { get; } = TimeSpan.FromMinutes(5);
    public string Status { get; }

    private EndpointConfiguration(Uri? endpoint, string status) { ProjectionEndpoint = endpoint; Status = status; }

    public static EndpointConfiguration Parse(string? endpoint)
    {
        if (string.IsNullOrWhiteSpace(endpoint)) return new(null, "Host endpoint is not configured.");
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) ||
            !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) ||
            !(uri.Scheme == "https" || uri.Scheme == "http" && uri.IsLoopback))
            return new(null, "Invalid host endpoint. Use HTTPS or loopback HTTP without credentials, query or fragment.");
        return new(uri, "Configured host projection endpoint.");
    }
}

public sealed class HttpHostState(HttpClient client, EndpointConfiguration configuration, TimeSpan? requestTimeout = null) : IHostState
{
    public const int MaximumResponseBytes = 2 * 1024 * 1024;

    public static HttpClient CreateClient() => new(new HttpClientHandler
    {
        AllowAutoRedirect = false, UseCookies = false, UseDefaultCredentials = false
    }) { Timeout = TimeSpan.FromSeconds(10) };

    public async Task<HostSnapshot> ReadAsync(CancellationToken cancellationToken)
    {
        if (configuration.ProjectionEndpoint is null) return HostSnapshot.Unavailable(configuration.Status);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(requestTimeout ?? TimeSpan.FromSeconds(10));
        var token = deadline.Token;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, configuration.ProjectionEndpoint);
            request.Headers.Accept.ParseAdd("application/json");
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
            if (response.StatusCode != HttpStatusCode.OK)
                return HostSnapshot.Unavailable($"Host projection unavailable (HTTP {(int)response.StatusCode}).");
            if (response.Content.Headers.ContentType?.MediaType is not "application/json")
                return HostSnapshot.Unavailable("Host response was not a JSON projection.");
            if (response.Content.Headers.ContentLength > MaximumResponseBytes)
                return HostSnapshot.Unavailable("Host projection exceeds the response limit.");
            await using var stream = await response.Content.ReadAsStreamAsync(token);
            using var buffer = new MemoryStream();
            var block = new byte[8192];
            int count;
            while ((count = await stream.ReadAsync(block, token)) > 0)
            {
                if (buffer.Length + count > MaximumResponseBytes)
                    return HostSnapshot.Unavailable("Host projection exceeds the response limit.");
                buffer.Write(block, 0, count);
            }
            return ContractJson.Decode<HostSnapshot>(new UTF8Encoding(false, true).GetString(buffer.ToArray()));
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        { return HostSnapshot.Unavailable("Host projection timed out."); }
        catch (Exception exception) when (exception is HttpRequestException or JsonException or DecoderFallbackException or IOException)
        { return HostSnapshot.Unavailable("Host projection could not be read or failed contract validation."); }
    }
}
