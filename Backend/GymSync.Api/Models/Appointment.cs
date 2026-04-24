namespace GymSync.Api.Models;

public enum AppointmentStatus
{
    Pending = 0,
    Confirmed = 1,
    Completed = 2,
    Cancelled = 3
}

public class Appointment
{
    public int Id { get; set; }

    public int MemberId { get; set; }
    public User? Member { get; set; }

    public int PTId { get; set; }
    public User? PT { get; set; }

    public int? AvailabilityId { get; set; }
    public Availability? Availability { get; set; }

    public DateTime AppointmentDate { get; set; }

    public AppointmentStatus Status { get; set; } = AppointmentStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
