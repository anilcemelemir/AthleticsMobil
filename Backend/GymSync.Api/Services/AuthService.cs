using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AutoMapper;
using GymSync.Api.Data;
using GymSync.Api.DTOs;
using GymSync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace GymSync.Api.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IMapper mapper, IConfiguration config)
    {
        _db = db;
        _mapper = mapper;
        _config = config;
    }

    public async Task<RegisterResponseDto?> RegisterAsync(RegisterDto dto)
    {
        // Email is now optional; treat blank as null. If supplied, ensure it's unique.
        var email = string.IsNullOrWhiteSpace(dto.Email)
            ? null
            : dto.Email.Trim().ToLowerInvariant();

        if (email is not null && await _db.Users.AnyAsync(u => u.Email == email))
            return null; // caller treats null as conflict

        // Generate a unique access key (retry on collision — effectively impossible).
        string key;
        var attempts = 0;
        do
        {
            key = AccessKeyGenerator.Generate();
            attempts++;
            if (attempts > 10) throw new InvalidOperationException("Failed to generate unique access key.");
        }
        while (await _db.Users.AnyAsync(u => u.UniqueAccessKey == key));

        var user = _mapper.Map<User>(dto);
        user.Email = email ?? $"{key.ToLowerInvariant()}@gymsync.local";
        user.UniqueAccessKey = key;
        // Password auth is deprecated, but the column is required — store a random hash
        // so nobody can ever sign in with email + password for new accounts.
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"));
        user.CreatedAt = DateTime.UtcNow;
        user.IsActive = true;

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return new RegisterResponseDto
        {
            User = _mapper.Map<UserDto>(user),
            AccessKey = key,
        };
    }

    public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || !user.IsActive)
            return null;

        if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return null;

        return BuildResponse(user);
    }

    public async Task<AuthResponseDto?> LoginWithKeyAsync(LoginWithKeyDto dto)
    {
        var key = dto.AccessKey.Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(key)) return null;

        // Allow users to type the key without the "GS-" prefix.
        if (!key.StartsWith(AccessKeyGenerator.Prefix, StringComparison.Ordinal))
            key = AccessKeyGenerator.Prefix + key;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UniqueAccessKey == key);
        if (user is null || !user.IsActive)
            return null;

        return BuildResponse(user);
    }

    private AuthResponseDto BuildResponse(User user)
    {
        var (token, expiresAt) = GenerateJwt(user);
        return new AuthResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = _mapper.Map<UserDto>(user)
        };
    }

    private (string token, DateTime expiresAt) GenerateJwt(User user)
    {
        var jwtSection = _config.GetSection("Jwt");
        var key = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key not configured");
        var issuer = jwtSection["Issuer"];
        var audience = jwtSection["Audience"];
        var expiresInMinutes = int.TryParse(jwtSection["ExpiresInMinutes"], out var m) ? m : 120;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("userId", user.Id.ToString()),
            new("role", user.Role.ToString())
        };

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var expiresAt = DateTime.UtcNow.AddMinutes(expiresInMinutes);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
