using System.Text.Json;
using Omnia.Contracts;
using Omnia.Host;
using Xunit;

namespace Omnia.Windows.Tests;

public sealed class ObservationTests
{
    [Fact]
    public void ZeroIsAnObservedValueAndUnknownIsNotZero()
    {
        var candidate = Fixtures.Snapshot().Candidates[0];
        Assert.Equal(0, candidate.SizeBytes.Value);
        Assert.Equal("0 bytes", ProjectionPresentation.Measure(candidate.SizeBytes, "bytes", Fixtures.Now, Fixtures.MaximumAge));
        Assert.Null(candidate.AgeDays.Value);
        Assert.Equal("Unknown", ProjectionPresentation.Measure(candidate.AgeDays, "days", Fixtures.Now, Fixtures.MaximumAge));
    }

    [Theory]
    [InlineData("known", null)]
    [InlineData("unknown", 0L)]
    [InlineData("unavailable", 0L)]
    [InlineData("known", -1L)]
    [InlineData("empty", null)]
    public void RejectsContradictoryMeasurement(string state, long? value)
    {
        var json = Fixtures.Json("host.snapshot.json");
        json["candidates"]![0]!["size_bytes"]!["state"] = state;
        json["candidates"]![0]!["size_bytes"]!["value"] = value;
        Assert.Throws<JsonException>(() => ContractJson.Decode<HostSnapshot>(json.ToJsonString()));
    }

    [Fact]
    public void KnownMeasurementsRequireTimestamp()
    {
        var json = Fixtures.Json("host.snapshot.json");
        json["candidates"]![0]!["size_bytes"]!.AsObject().Remove("observed_at");
        Assert.Throws<JsonException>(() => ContractJson.Decode<HostSnapshot>(json.ToJsonString()));
    }

    [Fact]
    public void StaleAndFutureObservationsCannotAppearFresh()
    {
        var value = Fixtures.Snapshot().Candidates[0].SizeBytes;
        Assert.Equal(Availability.Stale, value.StateAt(Fixtures.Now.AddHours(1), Fixtures.MaximumAge));
        Assert.Equal(Availability.Stale, value.StateAt(Fixtures.Now.AddHours(-1), Fixtures.MaximumAge));
        Assert.StartsWith("Stale", ProjectionPresentation.Measure(value, "bytes", Fixtures.Now.AddHours(1), Fixtures.MaximumAge));
    }

    [Fact]
    public void UnknownCollectionIsNotAnEmptyResult()
    {
        var unknown = HostSnapshot.Unavailable("Disconnected");
        Assert.Contains("No count has been inferred", ProjectionPresentation.EmptyMessage(unknown, Fixtures.Now, Fixtures.MaximumAge, "Candidates"));
        var empty = unknown with { State = Availability.Empty, ObservedAt = Fixtures.Now };
        Assert.StartsWith("No Candidates reported", ProjectionPresentation.EmptyMessage(empty, Fixtures.Now, Fixtures.MaximumAge, "Candidates"));
        Assert.Equal(Availability.Stale, empty.StateAt(Fixtures.Now.AddHours(1), Fixtures.MaximumAge));
    }

    [Fact]
    public void EmptyOrUnavailableSnapshotCannotSmuggleRows()
    {
        var snapshot = Fixtures.Snapshot();
        Assert.Throws<JsonException>(() => ContractJson.Encode(snapshot with { State = Availability.Empty }));
        Assert.Throws<JsonException>(() => ContractJson.Encode(snapshot with { State = Availability.Unavailable }));
    }

    [Fact]
    public void StaleEnvelopeDowngradesNestedKnownValuesWithoutChangingUnknowns()
    {
        var source = Fixtures.Snapshot() with { State = Availability.Stale };
        var effective = ProjectionPresentation.WithEffectiveFreshness(source, Fixtures.Now, Fixtures.MaximumAge);
        Assert.Equal(Availability.Stale, effective.Candidates[0].SizeBytes.State);
        Assert.Equal(Availability.Unknown, effective.Candidates[0].AgeDays.State);
        Assert.Equal(Availability.Stale, effective.Operations[0].Status.State);
        Assert.Equal(Availability.Known, source.Candidates[0].SizeBytes.State);
    }
}
