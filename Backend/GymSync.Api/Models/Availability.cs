namespace GymSync.Api.Models;

/// <summary>
/// A concrete bookable time slot owned by a Personal Trainer.
/// SlotStart / SlotEnd are stored as UTC.
/// </summary>
public class Availability
{
    public int Id { get; set; }

    public int PTId { get; set; }
    public User? PT { get; set; }

    public DateTime SlotStart { get; set; }

    public DateTime SlotEnd { get; set; }

    public bool IsBooked { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
