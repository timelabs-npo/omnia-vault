using System.Net;
using System.Text;
using Omnia.Contracts;
using Omnia.Host;
using Xunit;

namespace Omnia.Windows.Tests;

public sealed class TransportTests
{
    [Theory]
    [InlineData("https://host.example/projection", true)]
    [InlineData("http://127.0.0.1:4567/projection", true)]
    [InlineData("http://[::1]:4567/projection", true)]
    [InlineData("http://remote.example/projection", false)]
    [InlineData("file:///C:/secrets", false)]
    [InlineData("https://user:secret@host.example/projection", false)]
    [InlineData("https://host.example/projection?token=secret", false)]
    [InlineData("https://host.example/projection#secret", false)]
    [InlineData("invalid", false)]
    [InlineData(null, false)]
    public void ConfigurationNeverInfersAProductionEndpoint(string? input, bool accepted) =>
        Assert.Equal(accepted, EndpointConfiguration.Parse(input).ProjectionEndpoint is not null);

    [Fact]
    public async Task UnconfiguredHostDoesNotMakeARequest()
    {
        var handler = new RecordingHandler(_ => throw new InvalidOperationException("Unexpected network call"));
        using var client = new HttpClient(handler);
        Assert.Equal(Availability.Unavailable, (await new HttpHostState(client, EndpointConfiguration.Parse(null)).ReadAsync(default)).State);
        Assert.Empty(handler.Methods);
    }

    [Fact]
    public async Task ReadsOnlyGetAndDoesNotManufactureReceiptVerificationFrom200()
    {
        var handler = new RecordingHandler(_ => JsonResponse(Fixtures.Read("host.snapshot.json")));
        using var client = new HttpClient(handler);
        var snapshot = await Client(client).ReadAsync(default);
        Assert.Equal(new[] { HttpMethod.Get }, handler.Methods);
        Assert.Equal(Availability.Known, snapshot.State);
        Assert.Equal(ReceiptVerdict.Unavailable, ReceiptAssessmentService.Assess(snapshot.Operations[0], new UnavailableReceiptVerifier(), Fixtures.Now, Fixtures.MaximumAge).Verdict);
    }

    [Theory]
    [InlineData(202)][InlineData(204)][InlineData(302)][InlineData(401)][InlineData(404)][InlineData(500)]
    public async Task Non200IsUnavailableNotAnEmptySuccess(int status)
    {
        using var client = new HttpClient(new RecordingHandler(_ => new((HttpStatusCode)status)));
        Assert.Equal(Availability.Unavailable, (await Client(client).ReadAsync(default)).State);
    }

    [Theory]
    [InlineData("{}", "application/json")]
    [InlineData("null", "application/json")]
    [InlineData("<html>sign in</html>", "text/html")]
    public async Task InvalidOrWrongContentIsUnavailable(string body, string contentType)
    {
        using var client = new HttpClient(new RecordingHandler(_ => new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, contentType) }));
        Assert.Equal(Availability.Unavailable, (await Client(client).ReadAsync(default)).State);
    }

    [Fact]
    public async Task OversizedBodyIsRejected()
    {
        using var client = new HttpClient(new RecordingHandler(_ => JsonResponse(new string('x', HttpHostState.MaximumResponseBytes + 1))));
        var result = await Client(client).ReadAsync(default);
        Assert.Equal(Availability.Unavailable, result.State);
        Assert.Contains("limit", result.Detail);
    }

    [Fact]
    public async Task NetworkFailureIsRedactedAndUnavailable()
    {
        using var client = new HttpClient(new RecordingHandler(_ => throw new HttpRequestException("sensitive endpoint details")));
        var result = await Client(client).ReadAsync(default);
        Assert.Equal(Availability.Unavailable, result.State);
        Assert.DoesNotContain("sensitive", result.Detail);
    }

    [Fact]
    public async Task BodyReadHasDeadlineAfterHeadersAndCallerCancellationPropagates()
    {
        using var client = new HttpClient(new HangingHandler());
        var result = await new HttpHostState(client, EndpointConfiguration.Parse("http://localhost/projection"), TimeSpan.FromMilliseconds(50)).ReadAsync(default);
        Assert.Equal(Availability.Unavailable, result.State);
        Assert.Contains("timed out", result.Detail);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Client(client).ReadAsync(cancellation.Token));
    }

    private static HttpHostState Client(HttpClient client) => new(client, EndpointConfiguration.Parse("http://localhost/projection"));
    private static HttpResponseMessage JsonResponse(string content) => new(HttpStatusCode.OK) { Content = new StringContent(content, Encoding.UTF8, "application/json") };
    private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<HttpMethod> Methods { get; } = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        { cancellationToken.ThrowIfCancellationRequested(); Methods.Add(request.Method); return Task.FromResult(respond(request)); }
    }
    private sealed class HangingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(new HangingStream()) };
            response.Content.Headers.ContentType = new("application/json");
            return Task.FromResult(response);
        }
    }
    private sealed class HangingStream : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        { await Task.Delay(Timeout.Infinite, cancellationToken); return 0; }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
