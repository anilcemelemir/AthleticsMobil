namespace GymSync.Api.Models;

/// <summary>
/// A single body-measurement snapshot recorded by a member.
/// All numeric fields are nullable — members may log only the metrics they care about.
/// Stored chronologically; the analytics dashboard derives trends client-side.
/// </summary>
public class BodyMeasurement
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    /// <summary>When the measurement was taken (defaults to UTC now).</summary>
    public DateTime MeasuredAt { get; set; } = DateTime.UtcNow;

    // Core metrics
    public double? WeightKg { get; set; }
    public double? FatPercentage { get; set; }

    // Upper body (cm)
    public double? ShoulderCm { get; set; }
    public double? ChestCm { get; set; }
    public double? LeftArmCm { get; set; }
    public double? RightArmCm { get; set; }
    public double? ForearmCm { get; set; }

    // Core & lower body (cm)
    public double? WaistCm { get; set; }
    public double? HipsCm { get; set; }
    public double? LeftThighCm { get; set; }
    public double? RightThighCm { get; set; }
    public double? CalvesCm { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
