using System.Collections;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Omnia.Contracts;

public static class ContractJson
{
    private static readonly JsonSerializerOptions Options = CreateOptions();

    public static JsonSerializerOptions CreateOptions() => new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
        MaxDepth = 32,
        Converters = { new StrictEnumConverter() }
    };

    public static T Decode<T>(string json) where T : class
    {
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 32 });
        RejectDuplicateKeys(document.RootElement);
        ValidateProposalNulls(document.RootElement);
        var value = JsonSerializer.Deserialize<T>(json, Options) ?? throw new JsonException("Null document.");
        Validate(value);
        return value;
    }

    public static string Encode<T>(T value) where T : class
    {
        Validate(value);
        return JsonSerializer.Serialize(value, Options);
    }

    public static void Validate(object value)
    {
        ValidateRequired(value);
        switch (value)
        {
            case MaintenanceProposal p:
                Require(p.SchemaVersion == "maintenance-proposal/v1", "Unsupported proposal version.");
                Require(p.ProposalId.Length >= 8 && p.Source.System.Length >= 2 && p.Source.Revision.Length >= 7 && p.Source.RuleId.Length >= 1, "Missing proposal provenance.");
                Require(p.Platform.Adapter.Length >= 3 && p.Target.Locator.Length >= 1, "Invalid adapter or locator.");
                Require(p.Effect.Authority == ProposalAuthority.ProposalOnly, "Proposal-only authority required.");
                Require(p.Preconditions.MinAgeDays is null or >= 0 and <= 3650, "Invalid age precondition.");
                Require(p.EvidenceRequirements.Count > 0 && p.EvidenceRequirements.Distinct().Count() == p.EvidenceRequirements.Count, "Evidence requirements must be nonempty and unique.");
                Require(p.Metadata is null || p.Metadata.Value.ValueKind == JsonValueKind.Object, "Metadata must be an object.");
                break;
            case MaintenanceCandidate c:
                Validate(c.Proposal);
                ValidateObservation(c.SizeBytes); ValidateObservation(c.AgeDays);
                ValidateObservation(c.ResolvedItemId); ValidateObservation(c.ExpectedHead);
                Require(c.SizeBytes.Value is null or >= 0 && c.AgeDays.Value is null or >= 0, "Negative measurement.");
                break;
            case OperationProjection op:
                ValidateObservation(op.Status); ValidateObservation(op.ExpectedHead);
                if (op.Receipt is { } receipt)
                {
                    Require(receipt.Outcome is ReportedOperationStatus.Succeeded or ReportedOperationStatus.Failed or ReportedOperationStatus.Rejected, "Receipt requires a terminal outcome.");
                    Require(receipt.RecordedAt != default, "Receipt timestamp missing.");
                }
                break;
            case HostSnapshot s:
                Require(s.SchemaVersion == "omnia-windows-projection/v1", "Unsupported host projection version.");
                Require(s.State is not (Availability.Known or Availability.Empty) || s.ObservedAt is not null, "Fresh projection requires timestamp.");
                Require(s.State != Availability.Empty || s.Candidates.Count + s.Operations.Count == 0, "Empty projection contains items.");
                Require(s.State is not (Availability.Unknown or Availability.Unavailable) || s.Candidates.Count + s.Operations.Count == 0, "Unavailable projection contains items.");
                Require(s.Candidates.Select(c => c.CandidateId).Distinct().Count() == s.Candidates.Count, "Duplicate candidate identity.");
                Require(s.Candidates.Select(c => c.Proposal.ProposalId).Distinct().Count() == s.Candidates.Count, "Duplicate proposal identity.");
                Require(s.Operations.Select(o => o.OperationId).Distinct().Count() == s.Operations.Count, "Duplicate operation identity.");
                foreach (var candidate in s.Candidates) Validate(candidate);
                foreach (var operation in s.Operations) Validate(operation);
                break;
        }
    }

    private static void ValidateObservation<T>(Observation<T> o)
    {
        Require(o.State != Availability.Empty, "Scalar observations cannot be empty.");
        Require(o.State != Availability.Known || o.Value is not null && o.ObservedAt is not null, "Known observation requires value and timestamp.");
        Require(o.Value is not string text || !string.IsNullOrWhiteSpace(text), "Observed identity cannot be blank.");
        Require(o.State is not (Availability.Unknown or Availability.Unavailable) || o.Value is null, "Unknown/unavailable observation must not carry a value.");
        Require(o.State != Availability.Stale || o.Value is null || o.ObservedAt is not null, "Stale value requires original timestamp.");
    }

    private static void ValidateRequired(object? value)
    {
        if (value is null) throw new JsonException("Null nested value.");
        var type = value.GetType();
        if (type.IsEnum) { Require(Enum.IsDefined(type, value), "Undefined enum value."); return; }
        if (value is JsonElement || type.IsPrimitive || value is string or DateTimeOffset or decimal) return;
        if (value is IEnumerable values) { foreach (var item in values) ValidateRequired(item); return; }
        foreach (var property in type.GetProperties(BindingFlags.Instance | BindingFlags.Public))
        {
            var child = property.GetValue(value);
            if (property.IsDefined(typeof(System.Runtime.CompilerServices.RequiredMemberAttribute)))
                Require(child is not null && (child is not string text || !string.IsNullOrWhiteSpace(text)), "Required value missing: " + property.Name);
            if (child is not null) ValidateRequired(child);
        }
    }

    private static void RejectDuplicateKeys(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            var keys = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject())
            {
                Require(keys.Add(property.Name), "Duplicate JSON property.");
                RejectDuplicateKeys(property.Value);
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
            foreach (var item in element.EnumerateArray()) RejectDuplicateKeys(item);
    }

    private static void ValidateProposalNulls(JsonElement element, bool inProposal = false)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            inProposal |= element.TryGetProperty("schema_version", out var version) &&
                version.ValueKind == JsonValueKind.String && version.GetString() == "maintenance-proposal/v1";
            foreach (var property in element.EnumerateObject())
            {
                if (inProposal) Require(property.Value.ValueKind != JsonValueKind.Null, "Proposal fields cannot be explicitly null.");
                // Metadata content is opaque and may contain JSON nulls.
                if (!(inProposal && property.Name == "metadata")) ValidateProposalNulls(property.Value, inProposal);
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
            foreach (var child in element.EnumerateArray()) ValidateProposalNulls(child, inProposal);
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new JsonException(message);
    }
}
