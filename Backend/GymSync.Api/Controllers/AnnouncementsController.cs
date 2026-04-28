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
public class AnnouncementsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AnnouncementsController(AppDbContext db)
    {
        _db = db;
    }

    private int? GetUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(raw, out var id) ? id : null;
    }

    private static string AudienceLabel(UserRole? role) =>
        role switch
        {
            null => "All",
            UserRole.PT => "PT",
            UserRole.Member => "Member",
            _ => role.ToString()!,
        };

    private static UserRole? ParseAudience(string value)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            value.Equals("all", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("everyone", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }
        if (value.Equals("pt", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("trainer", StringComparison.OrdinalIgnoreCase))
        {
            return UserRole.PT;
        }
        if (value.Equals("member", StringComparison.OrdinalIgnoreCase))
        {
            return UserRole.Member;
        }
        throw new ArgumentException($"Unknown target audience '{value}'.");
    }

    /// <summary>
    /// Returns announcements visible to the current user that they have NOT dismissed.
    /// Used by the bell icon and the in-app notification list.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AnnouncementDto>>> GetMine()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _db.Users.FindAsync(userId.Value);
        if (user is null) return Unauthorized();

        var dismissedIds = await _db.AnnouncementDismissals
            .Where(d => d.UserId == userId.Value)
            .Select(d => d.AnnouncementId)
            .ToListAsync();

        var query = _db.Announcements
            .Include(a => a.CreatedBy)
            .AsQueryable();

        // Admins see every announcement (so they can see what they published);
        // PTs and Members see global ones plus those targeted at their role.
        if (user.Role != UserRole.Admin)
        {
            query = query.Where(a => a.TargetRole == null || a.TargetRole == user.Role);
        }

        var list = await query
            .Where(a => !dismissedIds.Contains(a.Id))
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AnnouncementDto
            {
                Id = a.Id,
                Title = a.Title,
                Content = a.Content,
                TargetAudience = AudienceLabel(a.TargetRole),
                CreatedByName = a.CreatedBy != null ? a.CreatedBy.FullName : string.Empty,
                CreatedAt = a.CreatedAt,
            })
            .ToListAsync();

        return Ok(list);
    }

    /// <summary>
    /// Hide an announcement for the current user. Idempotent.
    /// </summary>
    [HttpPost("{id:int}/dismiss")]
    public async Task<IActionResult> Dismiss(int id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var exists = await _db.Announcements.AnyAsync(a => a.Id == id);
        if (!exists) return NotFound();

        var already = await _db.AnnouncementDismissals
            .AnyAsync(d => d.AnnouncementId == id && d.UserId == userId.Value);
        if (!already)
        {
            _db.AnnouncementDismissals.Add(new AnnouncementDismissal
            {
                AnnouncementId = id,
                UserId = userId.Value,
                DismissedAt = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    /// <summary>
    /// Admin-only: list every announcement ever published.
    /// </summary>
    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IEnumerable<AnnouncementDto>>> GetAll()
    {
        var list = await _db.Announcements
            .Include(a => a.CreatedBy)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AnnouncementDto
            {
                Id = a.Id,
                Title = a.Title,
                Content = a.Content,
                TargetAudience = AudienceLabel(a.TargetRole),
                CreatedByName = a.CreatedBy != null ? a.CreatedBy.FullName : string.Empty,
                CreatedAt = a.CreatedAt,
            })
            .ToListAsync();

        return Ok(list);
    }

    /// <summary>
    /// Admin-only: publish a new announcement.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AnnouncementDto>> Create([FromBody] CreateAnnouncementDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        UserRole? target;
        try { target = ParseAudience(dto.TargetAudience); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }

        var announcement = new Announcement
        {
            Title = dto.Title.Trim(),
            Content = dto.Content.Trim(),
            TargetRole = target,
            CreatedById = userId.Value,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Announcements.Add(announcement);
        await _db.SaveChangesAsync();

        var creatorName = await _db.Users
            .Where(u => u.Id == userId.Value)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync() ?? string.Empty;

        return Ok(new AnnouncementDto
        {
            Id = announcement.Id,
            Title = announcement.Title,
            Content = announcement.Content,
            TargetAudience = AudienceLabel(announcement.TargetRole),
            CreatedByName = creatorName,
            CreatedAt = announcement.CreatedAt,
        });
    }

    /// <summary>
    /// Admin-only: delete an announcement globally (also clears all dismissals via cascade).
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var announcement = await _db.Announcements.FindAsync(id);
        if (announcement is null) return NotFound();

        _db.Announcements.Remove(announcement);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
