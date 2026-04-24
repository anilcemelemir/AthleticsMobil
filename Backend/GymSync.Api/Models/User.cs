using System.ComponentModel.DataAnnotations;

namespace GymSync.Api.Models;

public enum UserRole
{
    Admin = 0,
    PT = 1,      // Personal Trainer
    Member = 2
}

public class User
{
    public int Id { get; set; }

    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    public UserRole Role { get; set; } = UserRole.Member;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // --- Member-only fields (0 for Admin & PT) ---
    public int TotalCredits { get; set; } = 0;
    public int RemainingCredits { get; set; } = 0;

    // Navigation properties
    public ICollection<Availability> Availabilities { get; set; } = new List<Availability>();
    public ICollection<Appointment> MemberAppointments { get; set; } = new List<Appointment>();
    public ICollection<Appointment> PTAppointments { get; set; } = new List<Appointment>();
}
