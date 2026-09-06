using Omnia.Host;
using Xunit;

namespace Omnia.Windows.Tests;

public sealed class AttributionTests
{
    [Fact]
    public void EveryEmbeddedComponentHasAuthorsAndReadableOriginalNotices()
    {
        var components = AttributionCatalog.Load();
        Assert.NotEmpty(components);
        Assert.All(components, component =>
        {
            Assert.False(string.IsNullOrWhiteSpace(component.Authors));
            Assert.NotEmpty(component.LicenseFiles);
            Assert.False(string.IsNullOrWhiteSpace(AttributionCatalog.ReadNotices(component)));
        });
    }

    [Fact]
    public void NeutralProductLabelRetainsMaintenanceAuthorAndCopyright()
    {
        var component = Assert.Single(AttributionCatalog.Load(), entry => entry.ComponentId == "AdventDevInc/kudu");
        Assert.Equal("Maintenance definitions", component.DisplayName);
        Assert.Contains("Advent Development Inc", component.Authors);
        Assert.Contains("Copyright (c) 2026 Advent Development Inc", AttributionCatalog.ReadNotices(component));
    }
}
