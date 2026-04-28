using GymSync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GymSync.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Availability> Availabilities => Set<Availability>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<AnnouncementDismissal> AnnouncementDismissals => Set<AnnouncementDismissal>();
    public DbSet<TrainingProgram> TrainingPrograms => Set<TrainingProgram>();
    public DbSet<BodyMeasurement> BodyMeasurements => Set<BodyMeasurement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.HasIndex(u => u.UniqueAccessKey).IsUnique();
            entity.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<Availability>(entity =>
        {
            entity.HasOne(a => a.PT)
                  .WithMany(u => u.Availabilities)
                  .HasForeignKey(a => a.PTId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(a => new { a.PTId, a.SlotStart }).IsUnique();
            entity.HasIndex(a => a.SlotStart);
        });

        modelBuilder.Entity<Appointment>(entity =>
        {
            entity.Property(a => a.Status).HasConversion<string>().HasMaxLength(20);

            entity.HasOne(a => a.Member)
                  .WithMany(u => u.MemberAppointments)
                  .HasForeignKey(a => a.MemberId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.PT)
                  .WithMany(u => u.PTAppointments)
                  .HasForeignKey(a => a.PTId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.Availability)
                  .WithMany()
                  .HasForeignKey(a => a.AvailabilityId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(a => a.AppointmentDate);
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasOne(m => m.Sender)
                  .WithMany()
                  .HasForeignKey(m => m.SenderId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(m => m.Receiver)
                  .WithMany()
                  .HasForeignKey(m => m.ReceiverId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(m => new { m.SenderId, m.ReceiverId, m.Timestamp });
            entity.HasIndex(m => m.Timestamp);
        });

        modelBuilder.Entity<Announcement>(entity =>
        {
            entity.Property(a => a.TargetRole).HasConversion<string>().HasMaxLength(20);

            entity.HasOne(a => a.CreatedBy)
                  .WithMany()
                  .HasForeignKey(a => a.CreatedById)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(a => a.CreatedAt);
        });

        modelBuilder.Entity<AnnouncementDismissal>(entity =>
        {
            entity.HasOne(d => d.Announcement)
                  .WithMany(a => a.Dismissals)
                  .HasForeignKey(d => d.AnnouncementId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(d => d.User)
                  .WithMany()
                  .HasForeignKey(d => d.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(d => new { d.AnnouncementId, d.UserId }).IsUnique();
        });

        modelBuilder.Entity<TrainingProgram>(entity =>
        {
            entity.HasOne(p => p.Member)
                  .WithMany()
                  .HasForeignKey(p => p.MemberId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.AssignedBy)
                  .WithMany()
                  .HasForeignKey(p => p.AssignedById)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(p => p.MemberId).IsUnique();
        });

        modelBuilder.Entity<BodyMeasurement>(entity =>
        {
            entity.HasOne(m => m.User)
                  .WithMany()
                  .HasForeignKey(m => m.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(m => new { m.UserId, m.MeasuredAt });
        });
    }
}
