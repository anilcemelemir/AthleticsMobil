using System.Security.Cryptography;

namespace GymSync.Api.Services;

/// <summary>
/// Generates short, human-friendly access keys like "GS-72A9B".
/// Avoids easily-confused characters (0/O, 1/I).
/// </summary>
public static class AccessKeyGenerator
{
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars
    public const string Prefix = "GS-";

    public static string Generate(int suffixLength = 5)
    {
        Span<byte> bytes = stackalloc byte[suffixLength];
        RandomNumberGenerator.Fill(bytes);
        Span<char> chars = stackalloc char[suffixLength];
        for (var i = 0; i < suffixLength; i++)
        {
            chars[i] = Alphabet[bytes[i] % Alphabet.Length];
        }
        return Prefix + new string(chars);
    }
}
