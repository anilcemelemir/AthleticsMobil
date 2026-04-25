using GymSync.Api.Data;
using GymSync.Api.Models;
using GymSync.Api.Services;
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

        // Back-fill UniqueAccessKey for any existing rows that don't have a
        // proper "GS-" key yet (covers placeholders inserted by the migration).
        var legacy = await db.Users
            .Where(u => u.UniqueAccessKey == null
                        || u.UniqueAccessKey == ""
                        || u.UniqueAccessKey.StartsWith("TMP-"))
            .ToListAsync();
        if (legacy.Count > 0)
        {
            foreach (var u in legacy)
            {
                u.UniqueAccessKey = await GenerateUniqueKeyAsync(db);
            }
            await db.SaveChangesAsync();
            logger.LogInformation("Back-filled {Count} access keys for legacy users.", legacy.Count);
        }

        if (await db.Users.AnyAsync())
        {
            logger.LogInformation("Database already seeded. Skipping.");
            return;
        }

        var admin = new User
        {
            FullName = "Default Admin",
            Email = DefaultAdminEmail,
            UniqueAccessKey = await GenerateUniqueKeyAsync(db),
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
            new User { FullName = "Coach Burak Aslan", Email = "burak@gymsync.local", UniqueAccessKey = await GenerateUniqueKeyAsync(db), PasswordHash = ptPasswordHash, Role = UserRole.PT, CreatedAt = DateTime.UtcNow },
            new User { FullName = "Coach Selin Polat", Email = "selin@gymsync.local", UniqueAccessKey = await GenerateUniqueKeyAsync(db), PasswordHash = ptPasswordHash, Role = UserRole.PT, CreatedAt = DateTime.UtcNow },
        };
        db.Users.AddRange(samplePts);

        // Sample members so the Admin Management screen has data to display.
        var memberPasswordHash = BCrypt.Net.BCrypt.HashPassword("Member123!");
        var sampleMembers = new[]
        {
            new User { FullName = "Ayşe Yılmaz",   Email = "ayse@gymsync.local",   UniqueAccessKey = await GenerateUniqueKeyAsync(db), PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 12, RemainingCredits = 8,  CreatedAt = DateTime.UtcNow },
            new User { FullName = "Mehmet Demir",  Email = "mehmet@gymsync.local", UniqueAccessKey = await GenerateUniqueKeyAsync(db), PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 8,  RemainingCredits = 1,  CreatedAt = DateTime.UtcNow },
            new User { FullName = "Zeynep Kaya",   Email = "zeynep@gymsync.local", UniqueAccessKey = await GenerateUniqueKeyAsync(db), PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 12, RemainingCredits = 0,  CreatedAt = DateTime.UtcNow },
            new User { FullName = "Ali Çelik",     Email = "ali@gymsync.local",    UniqueAccessKey = await GenerateUniqueKeyAsync(db), PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 12, RemainingCredits = 11, CreatedAt = DateTime.UtcNow },
            new User { FullName = "Elif Şahin",    Email = "elif@gymsync.local",   UniqueAccessKey = await GenerateUniqueKeyAsync(db), PasswordHash = memberPasswordHash, Role = UserRole.Member, TotalCredits = 8,  RemainingCredits = 5,  CreatedAt = DateTime.UtcNow },
        };
        db.Users.AddRange(sampleMembers);

        await db.SaveChangesAsync();

        logger.LogInformation(
            "Seeded default admin: {Email} (password: {Password}, access key: {Key}).",
            DefaultAdminEmail, DefaultAdminPassword, admin.UniqueAccessKey);
        foreach (var u in samplePts.Concat(sampleMembers))
        {
            logger.LogInformation("Seeded {Role} {Name} -> access key {Key}", u.Role, u.FullName, u.UniqueAccessKey);
        }
    }

    private static async Task<string> GenerateUniqueKeyAsync(AppDbContext db)
    {
        for (var i = 0; i < 10; i++)
        {
            var key = AccessKeyGenerator.Generate();
            if (!await db.Users.AnyAsync(u => u.UniqueAccessKey == key)) return key;
        }
        throw new InvalidOperationException("Failed to generate unique access key.");
    }
}
