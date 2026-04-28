using System.ComponentModel.DataAnnotations;

namespace GymSync.Api.Models;

/// <summary>
/// A broadcast message published by an admin and shown to a selected audience
/// (everyone, only PTs, or only Members) until each user dismisses it.
/// </summary>
public class Announcement
{
    public int Id { get; set; }

    [Required, MaxLength(120)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(2000)]
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// null = visible to everyone (Member + PT). Otherwise restrict to the given role.
    /// Admins always see every announcement in the management list, but the
    /// notification bell uses this filter.
    /// </summary>
    public UserRole? TargetRole { get; set; }

    public int CreatedById { get; set; }
    public User? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<AnnouncementDismissal> Dismissals { get; set; } = new List<AnnouncementDismissal>();
}

/// <summary>
/// Tracks which user has dismissed (hidden) which announcement so the bell badge
/// only counts notifications they have not already acknowledged.
/// </summary>
public class AnnouncementDismissal
{
    public int Id { get; set; }

    public int AnnouncementId { get; set; }
    public Announcement? Announcement { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public DateTime DismissedAt { get; set; } = DateTime.UtcNow;
}
