using System.ComponentModel.DataAnnotations;

namespace GymSync.Api.Models;

/// <summary>
/// A digital training + nutrition program assigned to a single member by a PT (or Admin).
/// One program per member (1:1) — re-assigning overwrites the existing record.
/// </summary>
public class TrainingProgram
{
    public int Id { get; set; }

    public int MemberId { get; set; }
    public User? Member { get; set; }

    public int AssignedById { get; set; }
    public User? AssignedBy { get; set; }

    [MaxLength(8000)]
    public string WorkoutRoutine { get; set; } = string.Empty;

    [MaxLength(8000)]
    public string NutritionPlan { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
