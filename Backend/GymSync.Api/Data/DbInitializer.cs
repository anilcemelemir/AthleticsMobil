using GymSync.Api.Data;
using GymSync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GymSync.Api.Data;

public static class DbInitializer
{
    public const string DefaultAdminEmail = "admin@gymsync.local";
    public const string DefaultAdminPassword = "Admin123!";

    public static async Task InitializeAsync(IServiceProvider services, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Apply pending migrations automatically.
        await db.Database.MigrateAsync();

        if (await db.Users.AnyAsync())
        {
            logger.LogInformation("Database already seeded. Skipping.");
            return;
        }

        var admin = new User
        {
            FullName = "Default Admin",
            Email = DefaultAdminEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(DefaultAdminPassword),
            Role = UserRole.Admin,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        db.Users.Add(admin);

        // Sample Personal Trainers
        var ptPasswordHash = BCrypt.Net.BCrypt.HashPassword("Trainer123!");
        var samplePts = new[]
        {
            new User { FullName = "Coach Burak Aslan", Email = "burak@gymsync.local", PasswordHash = ptPasswordHash, Role = UserRole.PT, CreatedAt = DateTime.UtcNow },
            new User { FullName = "Coach Selin Polat", Email = "selin@gymsync.local", PasswordHash = ptPasswordHash, Role = UserRole.PT, CreatedAt = DateTime.UtcNow },
        };
        db.Users.AddRange(samplePts);

        // Sample members so the Admin Management screen has data to display.
        var memberPasswordHash = BCrypt.Net.BCrypt.HashPassword("Member123!");
        var sampleMembers = new[]
        {
            new User { FullName = "Ayşe Yılmaz",   Email = "ayse@gymsync.local",   PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 12, RemainingCredits = 8,  CreatedAt = DateTime.UtcNow },
            new User { FullName = "Mehmet Demir",  Email = "mehmet@gymsync.local", PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 8,  RemainingCredits = 1,  CreatedAt = DateTime.UtcNow },
            new User { FullName = "Zeynep Kaya",   Email = "zeynep@gymsync.local", PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 12, RemainingCredits = 0,  CreatedAt = DateTime.UtcNow },
            new User { FullName = "Ali Çelik",     Email = "ali@gymsync.local",    PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 12, RemainingCredits = 11, CreatedAt = DateTime.UtcNow },
            new User { FullName = "Elif Şahin",    Email = "elif@gymsync.local",   PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 8,  RemainingCredits = 5,  CreatedAt = DateTime.UtcNow },
        };
        db.Users.AddRange(sampleMembers);

        await db.SaveChangesAsync();

        logger.LogInformation(
            "Seeded default admin user: {Email} (password: {Password}). Change this in production!",
            DefaultAdminEmail, DefaultAdminPassword);
        logger.LogInformation("Seeded {Count} sample member accounts (password: Member123!).", sampleMembers.Length);
        logger.LogInformation("Seeded {Count} sample PT accounts (password: Trainer123!).", samplePts.Length);
    }
}
