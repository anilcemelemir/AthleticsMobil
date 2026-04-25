using GymSync.Api.DTOs;

namespace GymSync.Api.Services;

public interface IAuthService
{
    Task<RegisterResponseDto?> RegisterAsync(RegisterDto dto);
    Task<AuthResponseDto?> LoginAsync(LoginDto dto);
    Task<AuthResponseDto?> LoginWithKeyAsync(LoginWithKeyDto dto);
}
