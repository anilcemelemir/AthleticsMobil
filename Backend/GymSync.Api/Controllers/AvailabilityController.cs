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
public class AvailabilityController : ControllerBase
{
    private readonly AppDbContext _db;

    public AvailabilityController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// PT submits one or more available time slots for themselves.
    /// </summary>
    [HttpPost("set-slots")]
    [Authorize(Roles = "PT")]
    [ProducesResponseType(typeof(SetSlotsResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SetSlots([FromBody] SetSlotsDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var ptId = GetUserId();
        if (ptId is null)
            return Unauthorized();

        // Validate every slot up-front.
        foreach (var slot in dto.Slots)
        {
            if (slot.SlotEnd <= slot.SlotStart)
                return BadRequest(new { message = "SlotEnd must be after SlotStart for every slot." });
        }

        // Avoid creating duplicates of (PTId, SlotStart) - the unique index would throw otherwise.
        var requestedStarts = dto.Slots
            .Select(s => DateTime.SpecifyKind(s.SlotStart, DateTimeKind.Utc))
            .ToList();

        var existingStarts = await _db.Availabilities
            .Where(a => a.PTId == ptId && requestedStarts.Contains(a.SlotStart))
            .Select(a => a.SlotStart)
            .ToListAsync();

        var toCreate = dto.Slots
            .Where(s => !existingStarts.Contains(DateTime.SpecifyKind(s.SlotStart, DateTimeKind.Utc)))
            .Select(s => new Availability
            {
                PTId = ptId.Value,
                SlotStart = DateTime.SpecifyKind(s.SlotStart, DateTimeKind.Utc),
                SlotEnd = DateTime.SpecifyKind(s.SlotEnd, DateTimeKind.Utc),
                IsBooked = false,
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (toCreate.Count > 0)
        {
            _db.Availabilities.AddRange(toCreate);
            await _db.SaveChangesAsync();
        }

        var ptName = await _db.Users
            .Where(u => u.Id == ptId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync() ?? string.Empty;

        return Ok(new SetSlotsResponseDto
        {
            CreatedCount = toCreate.Count,
            SkippedDuplicateCount = dto.Slots.Count - toCreate.Count,
            Slots = toCreate.Select(s => new AvailabilityDto
            {
                Id = s.Id,
                PTId = s.PTId,
                PTName = ptName,
                SlotStart = s.SlotStart,
                SlotEnd = s.SlotEnd,
                IsBooked = s.IsBooked
            }).ToList()
        });
    }

    /// <summary>
    /// Returns all not-yet-booked future slots for a PT.
    /// </summary>
    [HttpGet("pt/{ptId:int}")]
    [ProducesResponseType(typeof(IEnumerable<AvailabilityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSlotsForPt(int ptId)
    {
        var pt = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == ptId && u.Role == UserRole.PT);

        if (pt is null)
            return NotFound(new { message = "PT not found." });

        var nowUtc = DateTime.UtcNow;

        var slots = await _db.Availabilities
            .AsNoTracking()
            .Where(a => a.PTId == ptId && !a.IsBooked && a.SlotStart > nowUtc)
            .OrderBy(a => a.SlotStart)
            .Select(a => new AvailabilityDto
            {
                Id = a.Id,
                PTId = a.PTId,
                PTName = pt.FullName,
                SlotStart = a.SlotStart,
                SlotEnd = a.SlotEnd,
                IsBooked = a.IsBooked
            })
            .ToListAsync();

        return Ok(slots);
    }

    /// <summary>
    /// Returns the current PT's own slots (past + future, both booked & free).
    /// </summary>
    [HttpGet("mine")]
    [Authorize(Roles = "PT")]
    [ProducesResponseType(typeof(IEnumerable<AvailabilityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMySlots()
    {
        var ptId = GetUserId();
        if (ptId is null)
            return Unauthorized();

        var ptName = await _db.Users
            .Where(u => u.Id == ptId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync() ?? string.Empty;

        var slots = await _db.Availabilities
            .AsNoTracking()
            .Where(a => a.PTId == ptId)
            .OrderBy(a => a.SlotStart)
            .Select(a => new AvailabilityDto
            {
                Id = a.Id,
                PTId = a.PTId,
                PTName = ptName,
                SlotStart = a.SlotStart,
                SlotEnd = a.SlotEnd,
                IsBooked = a.IsBooked
            })
            .ToListAsync();

        return Ok(slots);
    }

    /// <summary>
    /// Delete one of the current PT's own slots. Cannot delete a slot that
    /// has been booked by a member (would orphan the appointment).
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "PT")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteSlot(int id)
    {
        var ptId = GetUserId();
        if (ptId is null)
            return Unauthorized();

        var slot = await _db.Availabilities.FirstOrDefaultAsync(a => a.Id == id && a.PTId == ptId);
        if (slot is null)
            return NotFound(new { message = "Slot not found." });

        // If a real member appointment exists for this slot, refuse to delete.
        var hasAppointment = await _db.Appointments.AnyAsync(a => a.AvailabilityId == id);
        if (slot.IsBooked && hasAppointment)
            return Conflict(new { message = "Cannot delete a slot booked by a member." });

        _db.Availabilities.Remove(slot);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// PT manually toggles a slot's booked/blocked status (e.g. personal break).
    /// Only allowed when no real member appointment is linked to this slot.
    /// </summary>
    [HttpPatch("{id:int}/booked")]
    [Authorize(Roles = "PT")]
    [ProducesResponseType(typeof(AvailabilityDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetSlotBooked(int id, [FromBody] SetSlotBookedDto dto)
    {
        var ptId = GetUserId();
        if (ptId is null)
            return Unauthorized();

        var slot = await _db.Availabilities.FirstOrDefaultAsync(a => a.Id == id && a.PTId == ptId);
        if (slot is null)
            return NotFound(new { message = "Slot not found." });

        var hasAppointment = await _db.Appointments.AnyAsync(a => a.AvailabilityId == id);
        if (hasAppointment)
            return Conflict(new { message = "Slot is reserved by a member. Cancel the appointment first." });

        slot.IsBooked = dto.IsBooked;
        await _db.SaveChangesAsync();

        var ptName = await _db.Users
            .Where(u => u.Id == ptId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync() ?? string.Empty;

        return Ok(new AvailabilityDto
        {
            Id = slot.Id,
            PTId = slot.PTId,
            PTName = ptName,
            SlotStart = slot.SlotStart,
            SlotEnd = slot.SlotEnd,
            IsBooked = slot.IsBooked
        });
    }

    /// <summary>
    /// Returns a list of all PTs (basic info) for member-facing PT picker.
    /// </summary>
    [HttpGet("trainers")]
    [ProducesResponseType(typeof(IEnumerable<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTrainers()
    {
        var trainers = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.PT && u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new
            {
                id = u.Id,
                fullName = u.FullName,
                email = u.Email
            })
            .ToListAsync();

        return Ok(trainers);
    }

    private int? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? User.FindFirstValue("userId");
        return int.TryParse(claim, out var id) ? id : null;
    }
}
