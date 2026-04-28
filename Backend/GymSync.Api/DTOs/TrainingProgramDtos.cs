using System.ComponentModel.DataAnnotations;

namespace GymSync.Api.DTOs;

public class TrainingProgramDto
{
    public int MemberId { get; set; }
    public string MemberName { get; set; } = string.Empty;
    public int? AssignedById { get; set; }
    public string? AssignedByName { get; set; }
    public string WorkoutRoutine { get; set; } = string.Empty;
    public string NutritionPlan { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class UpsertTrainingProgramDto
{
    [MaxLength(8000)]
    public string WorkoutRoutine { get; set; } = string.Empty;

    [MaxLength(8000)]
    public string NutritionPlan { get; set; } = string.Empty;
}
