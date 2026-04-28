namespace GymSync.Api.DTOs;

public class BodyMeasurementDto
{
    public int Id { get; set; }
    public DateTime MeasuredAt { get; set; }

    public double? WeightKg { get; set; }
    public double? FatPercentage { get; set; }

    public double? ShoulderCm { get; set; }
    public double? ChestCm { get; set; }
    public double? LeftArmCm { get; set; }
    public double? RightArmCm { get; set; }
    public double? ForearmCm { get; set; }

    public double? WaistCm { get; set; }
    public double? HipsCm { get; set; }
    public double? LeftThighCm { get; set; }
    public double? RightThighCm { get; set; }
    public double? CalvesCm { get; set; }
}

public class CreateBodyMeasurementDto
{
    /// <summary>Optional override for the measurement timestamp; defaults to UTC now.</summary>
    public DateTime? MeasuredAt { get; set; }

    public double? WeightKg { get; set; }
    public double? FatPercentage { get; set; }

    public double? ShoulderCm { get; set; }
    public double? ChestCm { get; set; }
    public double? LeftArmCm { get; set; }
    public double? RightArmCm { get; set; }
    public double? ForearmCm { get; set; }

    public double? WaistCm { get; set; }
    public double? HipsCm { get; set; }
    public double? LeftThighCm { get; set; }
    public double? RightThighCm { get; set; }
    public double? CalvesCm { get; set; }
}
