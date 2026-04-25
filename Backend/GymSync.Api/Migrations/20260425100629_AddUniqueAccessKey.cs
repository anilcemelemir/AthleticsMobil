using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymSync.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueAccessKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UniqueAccessKey",
                table: "Users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            // Back-fill existing rows with a temporary unique value so the
            // unique index can be created. The DbInitializer will replace
            // these placeholders with proper "GS-XXXXX" keys on startup.
            migrationBuilder.Sql(@"
                UPDATE ""Users""
                SET ""UniqueAccessKey"" = CONCAT('TMP-', ""Id"")
                WHERE ""UniqueAccessKey"" IS NULL OR ""UniqueAccessKey"" = '';
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Users_UniqueAccessKey",
                table: "Users",
                column: "UniqueAccessKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_UniqueAccessKey",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UniqueAccessKey",
                table: "Users");
        }
    }
}
