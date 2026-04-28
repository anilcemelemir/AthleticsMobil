using System.Security.Claims;
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
public class ProgramsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProgramsController(AppDbContext db)
    {
        _db = db;
    }

    private int? GetUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(raw, out var id) ? id : null;
    }

    private static TrainingProgramDto ToDto(TrainingProgram p) => new()
    {
        MemberId = p.MemberId,
        MemberName = p.Member?.FullName ?? string.Empty,
        AssignedById = p.AssignedById,
        AssignedByName = p.AssignedBy?.FullName,
        WorkoutRoutine = p.WorkoutRoutine,
        NutritionPlan = p.NutritionPlan,
        UpdatedAt = p.UpdatedAt,
    };

    /// <summary>
    /// Returns the current member's assigned program, or 204 if none.
    /// </summary>
    [HttpGet("me")]
    [Authorize(Roles = "Member")]
    public async Task<IActionResult> GetMine()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var program = await _db.TrainingPrograms
            .AsNoTracking()
            .Include(p => p.Member)
            .Include(p => p.AssignedBy)
            .FirstOrDefaultAsync(p => p.MemberId == userId);

        if (program is null) return NoContent();
        return Ok(ToDto(program));
    }

    /// <summary>
    /// PT/Admin: returns the program assigned to a specific member, or 204 if none.
    /// </summary>
    [HttpGet("member/{memberId:int}")]
    [Authorize(Roles = "Admin,PT")]
    public async Task<IActionResult> GetForMember(int memberId)
    {
        var member = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == memberId && u.Role == UserRole.Member);
        if (member is null) return NotFound(new { message = "Member not found." });

        var program = await _db.TrainingPrograms
            .AsNoTracking()
            .Include(p => p.AssignedBy)
            .FirstOrDefaultAsync(p => p.MemberId == memberId);

        if (program is null)
        {
            return Ok(new TrainingProgramDto
            {
                MemberId = member.Id,
                MemberName = member.FullName,
                WorkoutRoutine = string.Empty,
                NutritionPlan = string.Empty,
                UpdatedAt = default,
            });
        }

        var dto = ToDto(program);
        dto.MemberName = member.FullName;
        return Ok(dto);
    }

    /// <summary>
    /// PT/Admin: assigns or updates the program for a member. Idempotent upsert.
    /// </summary>
    [HttpPut("member/{memberId:int}")]
    [Authorize(Roles = "Admin,PT")]
    public async Task<IActionResult> UpsertForMember(int memberId, [FromBody] UpsertTrainingProgramDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var assignedById = GetUserId();
        if (assignedById is null) return Unauthorized();

        var member = await _db.Users
            .FirstOrDefaultAsync(u => u.Id == memberId && u.Role == UserRole.Member);
        if (member is null) return NotFound(new { message = "Member not found." });

        var program = await _db.TrainingPrograms
            .Include(p => p.AssignedBy)
            .FirstOrDefaultAsync(p => p.MemberId == memberId);

        var now = DateTime.UtcNow;

        if (program is null)
        {
            program = new TrainingProgram
            {
                MemberId = memberId,
                AssignedById = assignedById.Value,
                WorkoutRoutine = dto.WorkoutRoutine ?? string.Empty,
                NutritionPlan = dto.NutritionPlan ?? string.Empty,
                CreatedAt = now,
                UpdatedAt = now,
            };
            _db.TrainingPrograms.Add(program);
        }
        else
        {
            program.WorkoutRoutine = dto.WorkoutRoutine ?? string.Empty;
            program.NutritionPlan = dto.NutritionPlan ?? string.Empty;
            program.AssignedById = assignedById.Value;
            program.UpdatedAt = now;
        }

        await _db.SaveChangesAsync();

        await _db.Entry(program).Reference(p => p.AssignedBy).LoadAsync();

        var resp = ToDto(program);
        resp.MemberName = member.FullName;
        return Ok(resp);
    }
}
