using AutoMapper;
using GymSync.Api.Data;
using GymSync.Api.DTOs;
using GymSync.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GymSync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;

    public UsersController(AppDbContext db, IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    /// <summary>
    /// Returns all users with the Member role. Admin and PT only.
    /// </summary>
    [HttpGet("members")]
    [Authorize(Roles = "Admin,PT")]
    [ProducesResponseType(typeof(IEnumerable<UserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMembers()
    {
        var members = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.Member)
            .OrderBy(u => u.FullName)
            .ToListAsync();

        return Ok(_mapper.Map<List<UserDto>>(members));
    }

    /// <summary>
    /// Returns all active personal trainers. Admin only.
    /// </summary>
    [HttpGet("trainers")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IEnumerable<UserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTrainers()
    {
        var trainers = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.PT && u.IsActive)
            .OrderBy(u => u.FullName)
            .ToListAsync();

        return Ok(_mapper.Map<List<UserDto>>(trainers));
    }

    /// <summary>
    /// Adds credits to a member. Admin only.
    /// </summary>
    [HttpPost("assign-credits")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(AssignCreditsResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignCredits([FromBody] AssignCreditsDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == dto.UserId);
        if (user is null)
            return NotFound(new { message = "User not found." });

        if (user.Role != UserRole.Member)
            return BadRequest(new { message = "Credits can only be assigned to members." });

        user.TotalCredits += dto.Amount;
        user.RemainingCredits += dto.Amount;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(new AssignCreditsResponseDto
        {
            Message = $"Added {dto.Amount} credits to {user.FullName}.",
            UserId = user.Id,
            TotalCredits = user.TotalCredits,
            RemainingCredits = user.RemainingCredits
        });
    }
}
