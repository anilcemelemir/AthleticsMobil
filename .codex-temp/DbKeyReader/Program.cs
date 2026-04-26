using Npgsql;

const string connectionString =
    "Host=localhost;Port=5432;Database=gymsync;Username=postgres;Password=postgres";

await using var connection = new NpgsqlConnection(connectionString);
await connection.OpenAsync();

await using var command = connection.CreateCommand();
command.CommandText = """
    SELECT "Id", "FullName", "Email", "Role", "UniqueAccessKey"
    FROM "Users"
    ORDER BY "Id";
    """;

await using var reader = await command.ExecuteReaderAsync();
while (await reader.ReadAsync())
{
    Console.WriteLine(
        $"{reader.GetInt32(0)} | {reader.GetString(1)} | {reader.GetString(2)} | Role={reader.GetInt32(3)} | Key={reader.GetString(4)}");
}
