using System.ComponentModel.DataAnnotations;
using GymSync.Api.Models;

namespace GymSync.Api.DTOs;

public class AnnouncementDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    /// <summary>"All", "PT" or "Member".</summary>
    public string TargetAudience { get; set; } = "All";
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateAnnouncementDto
{
    [Required, MaxLength(120)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(2000)]
    public string Content { get; set; } = string.Empty;

    /// <summary>"All", "PT" or "Member" (case-insensitive).</summary>
    [Required]
    public string TargetAudience { get; set; } = "All";
}
