# HRMS Pro - Database Schema (Initial)

This document describes the initial PostgreSQL schema for `HRMS Pro`. It focuses on core entities required for production usage: employees, users, roles, departments, attendance, leave, payroll exports, recruitment, performance reviews, training, benefits, documents, audit logs, integrations, and background jobs.

Important: Use migrations (e.g., Knex, TypeORM migrations, Flyway) to apply these changes.

## Entities

### `users`
- id (uuid, pk)
- email (varchar, unique, not null)
- password_hash (varchar) - nullable if SSO-only
- full_name (varchar)
- role_id (uuid, fk -> roles.id)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)

### `roles`
- id (uuid, pk)
- name (varchar)
- permissions (jsonb) - list of permission strings
- created_at, updated_at

### `employees`
- id (uuid, pk)
- employee_number (varchar, unique)
- first_name, last_name
- email (varchar)
- phone
- date_of_birth (date)
- join_date (date)
- termination_date (date, nullable)
- status (enum: Active, Terminated, OnLeave, Pending)
- department_id (uuid, fk -> departments.id)
- manager_id (uuid, fk -> employees.id)
- job_title
- location
- custom_fields (jsonb)
- created_at, updated_at

### `departments`
- id (uuid)
- name
- parent_id (uuid)
- created_at, updated_at

### `attendance`
- id (uuid)
- employee_id (uuid)
- date (date)
- clock_in (timestamp)
- clock_out (timestamp)
- duration_minutes (int)
- status (enum: Present, Absent, Late, Excused)
- notes (text)
- created_at, updated_at

### `leave_requests`
- id (uuid)
- employee_id (uuid)
- type (varchar)
- start_date (date)
- end_date (date)
- days (numeric)
- status (enum: Pending, Approved, Rejected, Cancelled)
- approver_id (uuid)
- notes (text)
- created_at, updated_at

### `payroll_exports`
- id (uuid)
- employee_id (uuid)
- month (int)
- year (int)
- gross_amount (numeric)
- net_amount (numeric)
- tax_details (jsonb)
- external_reference (varchar)
- created_at, updated_at

### `candidates`
- id (uuid)
- first_name, last_name, email, phone
- applied_on (timestamp)
- status (varchar)
- stage (varchar)
- resume_url
- notes (text)
- created_at, updated_at

### `performance_reviews`
- id (uuid)
- employee_id (uuid)
- reviewer_id (uuid)
- period (varchar)
- ratings (jsonb)
- average_rating (numeric)
- comments (text)
- goals (jsonb)
- created_at, updated_at

### `training_programs`
- id (uuid)
- name, description
- start_date, end_date
- instructor
- budget (numeric)
- created_at, updated_at

### `benefits`
- id (uuid)
- name, type, provider
- cost (numeric)
- coverage (text)
- created_at, updated_at

### `documents`
- id (uuid)
- employee_id (uuid)
- name
- url
- type
- uploaded_by (uuid)
- created_at, updated_at

### `audit_logs`
- id (uuid)
- actor_id (uuid)
- actor_type (user/employee/system)
- action (varchar)
- object_type (varchar)
- object_id (uuid)
- data (jsonb)
- ip_address (inet)
- created_at (timestamp)

### `integrations`
- id (uuid)
- name
- key (varchar)
- config (jsonb)
- enabled (boolean)
- last_synced_at (timestamp)
- created_at, updated_at

### `jobs`
- id (uuid)
- type (varchar)
- payload (jsonb)
- status (enum: queued, running, failed, done)
- attempts (int)
- last_error (text)
- created_at, updated_at

## Indexes & Constraints
- Index on `employees.employee_number`, `employees.email`
- Index on `attendance.employee_id,date`
- Full text index on `candidates` resume/note fields if needed
- Foreign keys enforced with cascade rules where appropriate

## Notes
- Consider partitioning `attendance` and `audit_logs` for very large datasets.
- Use `jsonb` for flexible custom fields and extension data.
- Use UUIDs for horizontal scaling and easier merge across environments.


