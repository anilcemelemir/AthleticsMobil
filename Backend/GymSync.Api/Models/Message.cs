using System.ComponentModel.DataAnnotations;

namespace GymSync.Api.Models;

public class Message
{
    public int Id { get; set; }

    public int SenderId { get; set; }
    public User? Sender { get; set; }

    public int ReceiverId { get; set; }
    public User? Receiver { get; set; }

    [Required, MaxLength(2000)]
    public string Content { get; set; } = string.Empty;

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public bool IsRead { get; set; }
}
