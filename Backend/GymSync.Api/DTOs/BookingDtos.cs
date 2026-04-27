using System.ComponentModel.DataAnnotations;

namespace GymSync.Api.DTOs;

public class AvailabilitySlotInputDto
{
    [Required]
    public DateTime SlotStart { get; set; }

    [Required]
    public DateTime SlotEnd { get; set; }
}

public class SetSlotsDto
{
    [Required, MinLength(1)]
    public List<AvailabilitySlotInputDto> Slots { get; set; } = new();
}

public class AvailabilityDto
{
    public int Id { get; set; }
    public int PTId { get; set; }
    public string PTName { get; set; } = string.Empty;
    public DateTime SlotStart { get; set; }
    public DateTime SlotEnd { get; set; }
    public bool IsBooked { get; set; }
}

public class SetSlotsResponseDto
{
    public int CreatedCount { get; set; }
    public int SkippedDuplicateCount { get; set; }
    public List<AvailabilityDto> Slots { get; set; } = new();
}

public class SetSlotBookedDto
{
    public bool IsBooked { get; set; }
}

public class BookAppointmentDto
{
    [Required]
    public int AvailabilityId { get; set; }
}

public class AppointmentDto
{
    public int Id { get; set; }
    public int? AvailabilityId { get; set; }
    public int MemberId { get; set; }
    public string MemberName { get; set; } = string.Empty;
    public string MemberEmail { get; set; } = string.Empty;
    public string? MemberPhoneNumber { get; set; }
    public int MemberRemainingCredits { get; set; }
    public int PTId { get; set; }
    public string PTName { get; set; } = string.Empty;
    public DateTime AppointmentDate { get; set; }
    public DateTime SlotStart { get; set; }
    public DateTime SlotEnd { get; set; }
    public string Status { get; set; } = string.Empty;
    public int RemainingCredits { get; set; }
    public DateTime CreatedAt { get; set; }
}
