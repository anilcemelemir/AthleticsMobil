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
    }
}
