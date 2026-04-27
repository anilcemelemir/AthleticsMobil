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
public class AppointmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<AppointmentsController> _logger;

    public AppointmentsController(AppDbContext db, ILogger<AppointmentsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Member books a specific availability slot. Performs the credit deduction
    /// and slot reservation atomically.
    /// </summary>
    [HttpPost("book")]
    [Authorize(Roles = "Member")]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Book([FromBody] BookAppointmentDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var memberId = GetUserId();
        if (memberId is null)
            return Unauthorized();

        // Wrap everything in a transaction so credit deduction + slot reservation
        // either both succeed or both roll back.
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var member = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == memberId && u.Role == UserRole.Member);
            if (member is null)
                return BadRequest(new { message = "Only members can book sessions." });

            // Rule 1: enough credits.
            if (member.RemainingCredits <= 0)
                return BadRequest(new { message = "You have no remaining credits. Please contact your admin." });

            // Rule 2: load the slot and verify it is still free.
            var slot = await _db.Availabilities
                .FirstOrDefaultAsync(a => a.Id == dto.AvailabilityId);
            if (slot is null)
                return NotFound(new { message = "Slot not found." });

            if (slot.IsBooked)
                return Conflict(new { message = "This slot has already been booked." });

            if (slot.SlotStart <= DateTime.UtcNow)
                return BadRequest(new { message = "This slot is in the past." });

            // Atomic action.
            slot.IsBooked = true;
            member.RemainingCredits -= 1;
            member.UpdatedAt = DateTime.UtcNow;

            var appointment = new Appointment
            {
                MemberId = member.Id,
                PTId = slot.PTId,
                AvailabilityId = slot.Id,
                AppointmentDate = slot.SlotStart,
                Status = AppointmentStatus.Confirmed,
                CreatedAt = DateTime.UtcNow
            };
            _db.Appointments.Add(appointment);

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            var ptName = await _db.Users
                .Where(u => u.Id == slot.PTId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync() ?? string.Empty;

            return Ok(new AppointmentDto
            {
                Id = appointment.Id,
                AvailabilityId = slot.Id,
                MemberId = member.Id,
                MemberName = member.FullName,
                MemberEmail = member.Email,
                MemberPhoneNumber = member.PhoneNumber,
                MemberRemainingCredits = member.RemainingCredits,
                PTId = slot.PTId,
                PTName = ptName,
                AppointmentDate = appointment.AppointmentDate,
                SlotStart = slot.SlotStart,
                SlotEnd = slot.SlotEnd,
                Status = appointment.Status.ToString(),
                RemainingCredits = member.RemainingCredits,
                CreatedAt = appointment.CreatedAt
            });
        }
        catch (DbUpdateException ex)
        {
            await tx.RollbackAsync();
            _logger.LogWarning(ex, "Booking conflict for availability {AvailabilityId}", dto.AvailabilityId);
            return Conflict(new { message = "Booking failed due to a conflict. Please try a different slot." });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Unexpected booking error.");
            throw;
        }
    }

    /// <summary>
    /// Returns appointments for the current user (member: own bookings, PT: own clients).
    /// </summary>
    [HttpGet("mine")]
    [ProducesResponseType(typeof(IEnumerable<AppointmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMine()
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized();

        var roleClaim = User.FindFirstValue(ClaimTypes.Role);

        IQueryable<Appointment> query = _db.Appointments
            .AsNoTracking()
            .Include(a => a.Member)
            .Include(a => a.PT)
            .Include(a => a.Availability);

        query = roleClaim switch
        {
            nameof(UserRole.Admin) => query,
            nameof(UserRole.PT) => query.Where(a => a.PTId == userId),
            _ => query.Where(a => a.MemberId == userId)
        };

        var list = await query
            .OrderByDescending(a => a.AppointmentDate)
            .Select(a => new AppointmentDto
            {
                Id = a.Id,
                AvailabilityId = a.AvailabilityId,
                MemberId = a.MemberId,
                MemberName = a.Member!.FullName,
                MemberEmail = a.Member.Email,
                MemberPhoneNumber = a.Member.PhoneNumber,
                MemberRemainingCredits = a.Member.RemainingCredits,
                PTId = a.PTId,
                PTName = a.PT!.FullName,
                AppointmentDate = a.AppointmentDate,
                SlotStart = a.Availability != null ? a.Availability.SlotStart : a.AppointmentDate,
                SlotEnd = a.Availability != null ? a.Availability.SlotEnd : a.AppointmentDate.AddHours(1),
                Status = a.Status.ToString(),
                RemainingCredits = a.Member.RemainingCredits,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();

        return Ok(list);
    }

    private int? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? User.FindFirstValue("userId");
        return int.TryParse(claim, out var id) ? id : null;
    }
}
