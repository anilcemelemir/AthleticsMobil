using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymSync.Api.Migrations
{
    /// <inheritdoc />
    public partial class AvailabilitySlotDateTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Availabilities_PTId_DayOfWeek_StartTime",
                table: "Availabilities");

            migrationBuilder.DropColumn(
                name: "DayOfWeek",
                table: "Availabilities");

            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "Availabilities");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "Availabilities");

            migrationBuilder.AddColumn<DateTime>(
                name: "SlotEnd",
                table: "Availabilities",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "SlotStart",
                table: "Availabilities",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "AvailabilityId",
                table: "Appointments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Availabilities_PTId_SlotStart",
                table: "Availabilities",
                columns: new[] { "PTId", "SlotStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Availabilities_SlotStart",
                table: "Availabilities",
                column: "SlotStart");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_AvailabilityId",
                table: "Appointments",
                column: "AvailabilityId");

            migrationBuilder.AddForeignKey(
                name: "FK_Appointments_Availabilities_AvailabilityId",
                table: "Appointments",
                column: "AvailabilityId",
                principalTable: "Availabilities",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Appointments_Availabilities_AvailabilityId",
                table: "Appointments");

            migrationBuilder.DropIndex(
                name: "IX_Availabilities_PTId_SlotStart",
                table: "Availabilities");

            migrationBuilder.DropIndex(
                name: "IX_Availabilities_SlotStart",
                table: "Availabilities");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_AvailabilityId",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "SlotEnd",
                table: "Availabilities");

            migrationBuilder.DropColumn(
                name: "SlotStart",
                table: "Availabilities");

            migrationBuilder.DropColumn(
                name: "AvailabilityId",
                table: "Appointments");

            migrationBuilder.AddColumn<int>(
                name: "DayOfWeek",
                table: "Availabilities",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "EndTime",
                table: "Availabilities",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0));

            migrationBuilder.AddColumn<TimeSpan>(
                name: "StartTime",
                table: "Availabilities",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0));

            migrationBuilder.CreateIndex(
                name: "IX_Availabilities_PTId_DayOfWeek_StartTime",
                table: "Availabilities",
                columns: new[] { "PTId", "DayOfWeek", "StartTime" });
        }
    }
}
