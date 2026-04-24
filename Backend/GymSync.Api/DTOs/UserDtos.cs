using System.ComponentModel.DataAnnotations;

namespace GymSync.Api.DTOs;

public class AssignCreditsDto
{
    [Required]
    public int UserId { get; set; }

    [Range(1, 1000, ErrorMessage = "Amount must be between 1 and 1000.")]
    public int Amount { get; set; }
}

public class AssignCreditsResponseDto
{
    public string Message { get; set; } = string.Empty;
    public int UserId { get; set; }
    public int TotalCredits { get; set; }
    public int RemainingCredits { get; set; }
}
