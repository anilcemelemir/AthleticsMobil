using System.ComponentModel.DataAnnotations;

namespace GymSync.Api.DTOs;

public class MessageDto
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public int ReceiverId { get; set; }
    public string ReceiverName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public bool IsRead { get; set; }
}

public class SendMessageDto
{
    [Required]
    public int ReceiverId { get; set; }

    [Required, MaxLength(2000)]
    public string Content { get; set; } = string.Empty;
}

public class BulkSendDto
{
    [Required, MinLength(1)]
    public List<int> MemberIds { get; set; } = new();

    [Required, MaxLength(2000)]
    public string Content { get; set; } = string.Empty;
}

public class BulkSendResponseDto
{
    public int SentCount { get; set; }
    public List<int> FailedMemberIds { get; set; } = new();
}

public class ConversationDto
{
    public int OtherUserId { get; set; }
    public string OtherUserName { get; set; } = string.Empty;
    public int OtherUserRole { get; set; }
    public string LastMessage { get; set; } = string.Empty;
    public DateTime LastTimestamp { get; set; }
    public int UnreadCount { get; set; }
}

public class TypingDto
{
    [Required]
    public int ReceiverId { get; set; }
}
