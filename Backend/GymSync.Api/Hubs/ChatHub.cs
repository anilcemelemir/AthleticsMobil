using System.Security.Claims;
using GymSync.Api.Data;
using GymSync.Api.DTOs;
using GymSync.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GymSync.Api.Hubs;

/// <summary>
/// Maps connection identity to the user's id so we can target users via
/// Clients.User(userId) regardless of how many devices/connections they have.
/// </summary>
public class UserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
    {
        var user = connection.User;
        return user?.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? user?.FindFirst("userId")?.Value;
    }
}

[Authorize]
public class ChatHub : Hub
{
    private readonly AppDbContext _db;

    public ChatHub(AppDbContext db)
    {
        _db = db;
    }

    private int GetUserId()
    {
        var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? Context.User?.FindFirst("userId")?.Value
                    ?? Context.UserIdentifier;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    /// <summary>
    /// Send a chat message. Persists to DB and pushes "ReceiveMessage" to both
    /// the receiver (if connected) and the sender (so other devices see it too).
    /// </summary>
    public async Task<MessageDto> SendMessage(int receiverId, string content)
    {
        var senderId = GetUserId();
        if (senderId == 0) throw new HubException("Unauthorized.");
        if (receiverId == senderId) throw new HubException("Cannot message yourself.");
        if (string.IsNullOrWhiteSpace(content)) throw new HubException("Empty message.");
        if (content.Length > 2000) content = content[..2000];

        var sender = await _db.Users.FindAsync(senderId)
                     ?? throw new HubException("Sender not found.");
        var receiver = await _db.Users.FirstOrDefaultAsync(u => u.Id == receiverId && u.IsActive)
                       ?? throw new HubException("Receiver not found.");

        var msg = new Message
        {
            SenderId = senderId,
            ReceiverId = receiverId,
            Content = content.Trim(),
            Timestamp = DateTime.UtcNow,
            IsRead = false,
        };
        _db.Messages.Add(msg);
        await _db.SaveChangesAsync();

        var dto = new MessageDto
        {
            Id = msg.Id,
            SenderId = senderId,
            SenderName = sender.FullName,
            ReceiverId = receiverId,
            ReceiverName = receiver.FullName,
            Content = msg.Content,
            Timestamp = msg.Timestamp,
            IsRead = msg.IsRead,
        };

        // Push to receiver (all their connections) and back to sender (other devices).
        await Clients.User(receiverId.ToString()).SendAsync("ReceiveMessage", dto);
        await Clients.User(senderId.ToString()).SendAsync("ReceiveMessage", dto);

        return dto;
    }

    /// <summary>Broadcast typing indicator. Not persisted.</summary>
    public async Task Typing(int receiverId)
    {
        var senderId = GetUserId();
        if (senderId == 0 || receiverId == senderId) return;
        await Clients.User(receiverId.ToString())
            .SendAsync("UserTyping", new { senderId });
    }

    /// <summary>Mark a single conversation's incoming messages as read.</summary>
    public async Task MarkAsRead(int otherUserId)
    {
        var me = GetUserId();
        if (me == 0) return;

        var unread = await _db.Messages
            .Where(m => m.SenderId == otherUserId && m.ReceiverId == me && !m.IsRead)
            .ToListAsync();

        if (unread.Count == 0) return;

        foreach (var m in unread) m.IsRead = true;
        await _db.SaveChangesAsync();

        await Clients.User(otherUserId.ToString())
            .SendAsync("MessagesRead", new { readerId = me });
    }
}
