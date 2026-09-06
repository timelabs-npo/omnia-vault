using System.Reflection;
using System.Text.Json;

namespace Omnia.Host;

public sealed record ComponentAttribution
{
    public required string ComponentId { get; init; }
    public required string DisplayName { get; init; }
    public required string Version { get; init; }
    public required string Authors { get; init; }
    public required string Scope { get; init; }
    public string? Copyright { get; init; }
    public required string License { get; init; }
    public required IReadOnlyList<string> LicenseFiles { get; init; }
}

public static class AttributionCatalog
{
    private sealed record Manifest(IReadOnlyList<ComponentAttribution> Components);
    private static readonly Assembly Assembly = typeof(AttributionCatalog).Assembly;

    public static IReadOnlyList<ComponentAttribution> Load()
    {
        using var stream = Assembly.GetManifestResourceStream("attribution.components.json")
            ?? throw new InvalidOperationException("Component attribution is missing.");
        return JsonSerializer.Deserialize<Manifest>(stream, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        })?.Components ?? throw new InvalidOperationException("Component attribution is invalid.");
    }

    public static string ReadNotices(ComponentAttribution component) => string.Join("\n\n────────\n\n",
        component.LicenseFiles.Select(path =>
        {
            // Only hashed embedded resources are read; there is no filesystem path access.
            using var stream = Assembly.GetManifestResourceStream("licenses." + path.Split('/')[^1])
                ?? throw new InvalidOperationException("Original notice is missing.");
            if (path.EndsWith(".rtf", StringComparison.OrdinalIgnoreCase))
                return "The publisher's original RTF license is preserved in the distribution's Licenses folder. " +
                    "The component authors and copyright are listed above.";
            using var reader = new StreamReader(stream);
            return reader.ReadToEnd();
        }));
}
