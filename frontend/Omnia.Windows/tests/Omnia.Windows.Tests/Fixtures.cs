using System.Text.Json.Nodes;
using Omnia.Contracts;

namespace Omnia.Windows.Tests;

internal static class Fixtures
{
    public static DateTimeOffset Now => DateTimeOffset.Parse("2026-09-06T12:01:00+00:00");
    public static TimeSpan MaximumAge => TimeSpan.FromMinutes(5);
    public static string Read(string file) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", file));
    public static JsonObject Json(string file) => JsonNode.Parse(Read(file))!.AsObject();
    public static HostSnapshot Snapshot() => ContractJson.Decode<HostSnapshot>(Read("host.snapshot.json"));
}
