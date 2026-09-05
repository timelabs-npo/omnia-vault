using System.Globalization;
using Omnia.Contracts;

namespace Omnia.Host;

public static class ProjectionPresentation
{
    public static HostSnapshot WithEffectiveFreshness(HostSnapshot snapshot, DateTimeOffset now, TimeSpan maximumAge)
    {
        if (snapshot.StateAt(now, maximumAge) != Availability.Stale) return snapshot;
        return snapshot with
        {
            State = Availability.Stale,
            Candidates = snapshot.Candidates.Select(c => c with
            {
                SizeBytes = Stale(c.SizeBytes), AgeDays = Stale(c.AgeDays),
                ResolvedItemId = Stale(c.ResolvedItemId), ExpectedHead = Stale(c.ExpectedHead)
            }).ToArray(),
            Operations = snapshot.Operations.Select(o => o with { Status = Stale(o.Status), ExpectedHead = Stale(o.ExpectedHead) }).ToArray()
        };
    }

    private static Observation<T> Stale<T>(Observation<T> observation) => observation.State == Availability.Known
        ? observation with { State = Availability.Stale } : observation;

    public static string Measure(Observation<long?> observation, string unit, DateTimeOffset now, TimeSpan maximumAge)
    {
        var state = observation.StateAt(now, maximumAge);
        var amount = observation.Value?.ToString("N0", CultureInfo.CurrentCulture);
        return state switch
        {
            Availability.Known => $"{amount} {unit}",
            Availability.Stale when amount is not null => $"Stale · {amount} {unit}",
            _ => state.ToString()
        };
    }

    public static string Identity(Observation<string> observation, DateTimeOffset now, TimeSpan maximumAge)
        => observation.StateAt(now, maximumAge) == Availability.Known
            ? observation.Value! : $"{observation.StateAt(now, maximumAge)}{(observation.Value is null ? "" : " · " + observation.Value)}";

    public static string EmptyMessage(HostSnapshot snapshot, DateTimeOffset now, TimeSpan maximumAge, string noun)
        => snapshot.StateAt(now, maximumAge) switch
        {
            Availability.Known or Availability.Empty => $"No {noun} reported in this host observation.",
            Availability.Stale => $"Stale observation; the current {noun} count is unknown.",
            _ => $"{noun} are {snapshot.State.ToString().ToLowerInvariant()}. No count has been inferred."
        };
}
