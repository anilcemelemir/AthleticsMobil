using System.Security.Claims;
using GymSync.Api.Data;
using GymSync.Api.DTOs;
using GymSync.Api.Hubs;
using GymSync.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GymSync.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public ChatController(AppDbContext db, IHubContext<ChatHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    private int GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? User.FindFirstValue("userId");
        return int.TryParse(claim, out var id) ? id : 0;
    }

    /// <summary>
    /// Paginated history between the current user and another user.
    /// `before` is an ISO timestamp; returns up to `pageSize` messages older than that.
    /// </summary>
    [HttpGet("history/{otherUserId:int}")]
    public async Task<ActionResult<List<MessageDto>>> GetHistory(
        int otherUserId,
        [FromQuery] DateTime? before = null,
        [FromQuery] int pageSize = 50)
    {
        var me = GetUserId();
        if (me == 0) return Unauthorized();
        if (pageSize is < 1 or > 200) pageSize = 50;

        var cutoff = before ?? DateTime.UtcNow.AddYears(1);

        var query = _db.Messages
            .Include(m => m.Sender)
            .Include(m => m.Receiver)
            .Where(m =>
                ((m.SenderId == me && m.ReceiverId == otherUserId) ||
                 (m.SenderId == otherUserId && m.ReceiverId == me)) &&
                m.Timestamp < cutoff)
            .OrderByDescending(m => m.Timestamp)
            .Take(pageSize);

        var rows = await query.ToListAsync();
        // Return chronological (oldest first) for easy append in UI.
        rows.Reverse();

        return Ok(rows.Select(m => ToDto(m)).ToList());
    }

    /// <summary>List of conversations for the current user with last message + unread count.</summary>
    [HttpGet("conversations")]
    public async Task<ActionResult<List<ConversationDto>>> GetConversations()
    {
        var me = GetUserId();
        if (me == 0) return Unauthorized();

        var rows = await _db.Messages
            .Include(m => m.Sender)
            .Include(m => m.Receiver)
            .Where(m => m.SenderId == me || m.ReceiverId == me)
            .ToListAsync();

        var conversations = rows
            .GroupBy(m => m.SenderId == me ? m.ReceiverId : m.SenderId)
            .Select(g =>
            {
                var last = g.OrderByDescending(m => m.Timestamp).First();
                var other = last.SenderId == me ? last.Receiver : last.Sender;
                return new ConversationDto
                {
                    OtherUserId = g.Key,
                    OtherUserName = other?.FullName ?? "Unknown",
                    OtherUserRole = (int)(other?.Role ?? UserRole.Member),
                    LastMessage = last.Content,
                    LastTimestamp = last.Timestamp,
                    UnreadCount = g.Count(m => m.ReceiverId == me && !m.IsRead),
                };
            })
            .OrderByDescending(c => c.LastTimestamp)
            .ToList();

        return Ok(conversations);
    }

    /// <summary>Send a message via REST (mirrors the hub behavior, useful as a fallback).</summary>
    [HttpPost("send")]
    public async Task<ActionResult<MessageDto>> Send([FromBody] SendMessageDto dto)
    {
        var me = GetUserId();
        if (me == 0) return Unauthorized();
        if (dto.ReceiverId == me) return BadRequest(new { message = "Cannot message yourself." });

        var sender = await _db.Users.FindAsync(me);
        var receiver = await _db.Users.FirstOrDefaultAsync(u => u.Id == dto.ReceiverId && u.IsActive);
        if (sender is null || receiver is null) return NotFound(new { message = "User not found." });

        var msg = new Message
        {
            SenderId = me,
            ReceiverId = dto.ReceiverId,
            Content = dto.Content.Trim(),
            Timestamp = DateTime.UtcNow,
            IsRead = false,
        };
        _db.Messages.Add(msg);
        await _db.SaveChangesAsync();

        var result = ToDto(msg, sender, receiver);
        await _hub.Clients.User(dto.ReceiverId.ToString()).SendAsync("ReceiveMessage", result);
        await _hub.Clients.User(me.ToString()).SendAsync("ReceiveMessage", result);
        return Ok(result);
    }

    /// <summary>Admin/PT: send the same message to many recipients at once.</summary>
    [HttpPost("bulk-send")]
    [Authorize(Roles = "Admin,PT")]
    public async Task<ActionResult<BulkSendResponseDto>> BulkSend([FromBody] BulkSendDto dto)
    {
        var me = GetUserId();
        var role = User.FindFirstValue(ClaimTypes.Role);
        Console.WriteLine($"[ChatController] bulk-send userId={me} role={role} count={dto?.MemberIds?.Count ?? 0}");
        if (me == 0) return Unauthorized();

        var content = dto.Content?.Trim();
        if (string.IsNullOrWhiteSpace(content))
            return BadRequest(new { message = "Content is required." });

        var ids = dto.MemberIds.Distinct().Where(id => id != me).ToList();
        if (ids.Count == 0)
            return BadRequest(new { message = "Select at least one recipient." });

        var sender = await _db.Users.FindAsync(me);
        if (sender is null) return Unauthorized();

        var senderRole = sender.Role;
        var recipients = await _db.Users
            .Where(u => ids.Contains(u.Id) && u.IsActive)
            .ToListAsync();

        if (senderRole == UserRole.PT)
        {
            recipients = recipients.Where(u => u.Role == UserRole.Member).ToList();
        }
        else if (senderRole == UserRole.Admin)
        {
            recipients = recipients.Where(u => u.Role is UserRole.Member or UserRole.PT).ToList();
        }

        var foundIds = recipients.Select(m => m.Id).ToHashSet();
        var failed = ids.Where(id => !foundIds.Contains(id)).ToList();

        var now = DateTime.UtcNow;
        var messages = recipients.Select(m => new Message
        {
            SenderId = me,
            ReceiverId = m.Id,
            Content = content!,
            Timestamp = now,
            IsRead = false,
        }).ToList();

        if (messages.Count > 0)
        {
            _db.Messages.AddRange(messages);
            await _db.SaveChangesAsync();

            // Fan out via SignalR.
            for (var i = 0; i < messages.Count; i++)
            {
                var m = messages[i];
                var recv = recipients[i];
                var payload = ToDto(m, sender, recv);
                await _hub.Clients.User(recv.Id.ToString()).SendAsync("ReceiveMessage", payload);
            }
            // Notify sender's other devices once (per recipient).
            foreach (var m in messages)
            {
                var recv = recipients.First(u => u.Id == m.ReceiverId);
                await _hub.Clients.User(me.ToString())
                    .SendAsync("ReceiveMessage", ToDto(m, sender, recv));
            }
        }

        return Ok(new BulkSendResponseDto
        {
            SentCount = messages.Count,
            FailedMemberIds = failed,
        });
    }

    private static MessageDto ToDto(Message m, User? sender = null, User? receiver = null) => new()
    {
        Id = m.Id,
        SenderId = m.SenderId,
        SenderName = (sender ?? m.Sender)?.FullName ?? string.Empty,
        ReceiverId = m.ReceiverId,
        ReceiverName = (receiver ?? m.Receiver)?.FullName ?? string.Empty,
        Content = m.Content,
        Timestamp = m.Timestamp,
        IsRead = m.IsRead,
    };
}
