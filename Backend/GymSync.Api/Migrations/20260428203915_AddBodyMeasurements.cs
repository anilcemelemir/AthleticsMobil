using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace GymSync.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBodyMeasurements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BodyMeasurements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    MeasuredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WeightKg = table.Column<double>(type: "double precision", nullable: true),
                    FatPercentage = table.Column<double>(type: "double precision", nullable: true),
                    ShoulderCm = table.Column<double>(type: "double precision", nullable: true),
                    ChestCm = table.Column<double>(type: "double precision", nullable: true),
                    LeftArmCm = table.Column<double>(type: "double precision", nullable: true),
                    RightArmCm = table.Column<double>(type: "double precision", nullable: true),
                    ForearmCm = table.Column<double>(type: "double precision", nullable: true),
                    WaistCm = table.Column<double>(type: "double precision", nullable: true),
                    HipsCm = table.Column<double>(type: "double precision", nullable: true),
                    LeftThighCm = table.Column<double>(type: "double precision", nullable: true),
                    RightThighCm = table.Column<double>(type: "double precision", nullable: true),
                    CalvesCm = table.Column<double>(type: "double precision", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BodyMeasurements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BodyMeasurements_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BodyMeasurements_UserId_MeasuredAt",
                table: "BodyMeasurements",
                columns: new[] { "UserId", "MeasuredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BodyMeasurements");
        }
    }
}
