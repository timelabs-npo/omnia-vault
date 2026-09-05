using System.Text.Json;
using System.Text.Json.Serialization;

namespace Omnia.Contracts;

// The platform converter accepts case-insensitive values; the playbook enum contract does not.
public sealed class StrictEnumConverter : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;
    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
        => (JsonConverter)Activator.CreateInstance(typeof(EnumConverter<>).MakeGenericType(typeToConvert))!;

    private sealed class EnumConverter<T> : JsonConverter<T> where T : struct, Enum
    {
        private static readonly Dictionary<string, T> Values = Enum.GetValues<T>()
            .ToDictionary(value => JsonNamingPolicy.SnakeCaseLower.ConvertName(value.ToString()), StringComparer.Ordinal);
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            => reader.TokenType == JsonTokenType.String && Values.TryGetValue(reader.GetString()!, out var value)
                ? value : throw new JsonException("Unsupported enum value.");
        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
        {
            if (!Enum.IsDefined(value)) throw new JsonException("Unsupported enum value.");
            writer.WriteStringValue(JsonNamingPolicy.SnakeCaseLower.ConvertName(value.ToString()));
        }
    }
}
