-- Optional seed data for local development.
-- bcrypt hash below corresponds to the password: "password123"
insert into public.users (id, username, email, password_hash, role)
values
  ('00000000-0000-0000-0000-000000000001',
   'admin',
   'admin@golipooli.dev',
   '$2b$10$8aBwm0iX1ZN3uS9Q1mEHQ.MZpJjFf9KdC1F7mEQ7nx8j2VbZyQjti',
   'admin')
on conflict do nothing;
