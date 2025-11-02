#!/bin/bash
# Run database migration to add cache columns
# Usage: ./run_migration.sh

# Load connection string from .env or prompt user
if [ -f .env ]; then
    source .env
fi

if [ -z "$DB_CONNECTION_STRING" ]; then
    echo "Enter your database connection string:"
    read -r DB_CONNECTION_STRING
fi

echo "Running migration..."
psql "$DB_CONNECTION_STRING" -f database_migration_add_cache.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed. Check the error above."
    exit 1
fi

