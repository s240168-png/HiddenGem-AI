# Runtime / seed data

MongoDB is the production source of truth.

The repository intentionally does **not** ship real `users.json`, `users.backup.json`, or other credential-bearing backup files in the deployment archive. If you use the local seed workflow, provide your own local seed data and keep it outside version control.

Static experience datasets can be imported with `npm run seed` when the corresponding JSON files are present.
