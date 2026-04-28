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
public class BodyMeasurementsController : ControllerBase
{
    private readonly AppDbContext _db;

    public BodyMeasurementsController(AppDbContext db)
    {
        _db = db;
    }

    private int? GetUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(raw, out var id) ? id : null;
    }

    private static BodyMeasurementDto ToDto(BodyMeasurement m) => new()
    {
        Id = m.Id,
        MeasuredAt = m.MeasuredAt,
        WeightKg = m.WeightKg,
        FatPercentage = m.FatPercentage,
        ShoulderCm = m.ShoulderCm,
        ChestCm = m.ChestCm,
        LeftArmCm = m.LeftArmCm,
        RightArmCm = m.RightArmCm,
        ForearmCm = m.ForearmCm,
        WaistCm = m.WaistCm,
        HipsCm = m.HipsCm,
        LeftThighCm = m.LeftThighCm,
        RightThighCm = m.RightThighCm,
        CalvesCm = m.CalvesCm,
    };

    /// <summary>
    /// Returns all measurements for the current user, oldest first (for trend charts).
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMine()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var list = await _db.BodyMeasurements
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderBy(m => m.MeasuredAt)
            .ToListAsync();

        return Ok(list.Select(ToDto).ToList());
    }

    /// <summary>
    /// Adds a new measurement entry for the current user.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBodyMeasurementDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var entity = new BodyMeasurement
        {
            UserId = userId.Value,
            MeasuredAt = dto.MeasuredAt ?? DateTime.UtcNow,
            WeightKg = dto.WeightKg,
            FatPercentage = dto.FatPercentage,
            ShoulderCm = dto.ShoulderCm,
            ChestCm = dto.ChestCm,
            LeftArmCm = dto.LeftArmCm,
            RightArmCm = dto.RightArmCm,
            ForearmCm = dto.ForearmCm,
            WaistCm = dto.WaistCm,
            HipsCm = dto.HipsCm,
            LeftThighCm = dto.LeftThighCm,
            RightThighCm = dto.RightThighCm,
            CalvesCm = dto.CalvesCm,
            CreatedAt = DateTime.UtcNow,
        };

        _db.BodyMeasurements.Add(entity);
        await _db.SaveChangesAsync();

        return Ok(ToDto(entity));
    }

    /// <summary>
    /// Deletes one of the current user's measurements.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var entity = await _db.BodyMeasurements
            .FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId);
        if (entity is null) return NotFound();

        _db.BodyMeasurements.Remove(entity);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
