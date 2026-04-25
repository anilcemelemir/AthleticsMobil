using System.ComponentModel.DataAnnotations;
using GymSync.Api.Models;

namespace GymSync.Api.DTOs;

/// <summary>
/// Admin-only payload used to register a new user.
/// Email is optional (kept for contact only); password is no longer required —
/// the server generates a UniqueAccessKey that the user signs in with.
/// </summary>
public class RegisterDto
{
    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [EmailAddress, MaxLength(256)]
    public string? Email { get; set; }

    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    public UserRole Role { get; set; } = UserRole.Member;
}

/// <summary>Legacy email + password login (kept for the seeded admin).</summary>
public class LoginDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

/// <summary>Sign in with the unique access key that was issued at registration.</summary>
public class LoginWithKeyDto
{
    [Required, MaxLength(20)]
    public string AccessKey { get; set; } = string.Empty;
}

public class UserDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public UserRole Role { get; set; }
    public string UniqueAccessKey { get; set; } = string.Empty;
    public int TotalCredits { get; set; }
    public int RemainingCredits { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserDto User { get; set; } = default!;
}

/// <summary>Returned by Admin register so the Admin can read the key out loud.</summary>
public class RegisterResponseDto
{
    public UserDto User { get; set; } = default!;
    public string AccessKey { get; set; } = string.Empty;
}
