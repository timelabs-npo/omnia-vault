using System.Text.Json;
using System.Text.Json.Nodes;
using Omnia.Contracts;
using Omnia.Host;
using Xunit;

namespace Omnia.Windows.Tests;

public sealed class SchemaExportTests
{
    [Fact]
    public void ExportActualNormalizerOutputForIndependentSchemaValidation()
    {
        var proposals = KuduDiscovery.LoadWindowsCatalog().Candidates.Select(c => c.Proposal).ToList();
        foreach (var family in Enum.GetValues<PlatformFamily>())
        {
            var name = family.ToString().ToLowerInvariant();
            var rule = KuduDiscovery.DecodeRule(Fixtures.Read($"parity/{name}.rule.json"));
            proposals.Add(KuduDiscovery.Normalize(rule, family, "system/cleanTargets/0").Candidate!.Proposal);
        }
        Assert.NotEmpty(proposals);
        var json = new JsonArray(proposals.Select(p => JsonNode.Parse(ContractJson.Encode(p))).ToArray());
        File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "normalized-proposals.json"), json.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
    }
}
