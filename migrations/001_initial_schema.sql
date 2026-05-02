-- 001_initial_schema.sql
-- Initial PostgreSQL schema for HRMS Pro

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles
CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(100) NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email varchar(255) UNIQUE NOT NULL,
    password_hash varchar(255),
    full_name varchar(255),
    role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Departments
CREATE TABLE departments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(255) NOT NULL,
    parent_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Employees
CREATE TABLE employees (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_number varchar(50) UNIQUE,
    first_name varchar(100),
    last_name varchar(100),
    email varchar(255),
    phone varchar(50),
    date_of_birth date,
    join_date date,
    termination_date date,
    status varchar(50) DEFAULT 'Active',
    department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
    job_title varchar(255),
    location varchar(255),
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Attendance
CREATE TABLE attendance (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    date date NOT NULL,
    clock_in timestamptz,
    clock_out timestamptz,
    duration_minutes int,
    status varchar(50),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);

-- Leave Requests
CREATE TABLE leave_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    type varchar(100),
    start_date date,
    end_date date,
    days numeric,
    status varchar(50) DEFAULT 'Pending',
    approver_id uuid REFERENCES employees(id),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payroll Exports
CREATE TABLE payroll_exports (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    month int,
    year int,
    gross_amount numeric,
    net_amount numeric,
    tax_details jsonb DEFAULT '{}'::jsonb,
    external_reference varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Candidates
CREATE TABLE candidates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name varchar(100),
    last_name varchar(100),
    email varchar(255),
    phone varchar(50),
    applied_on timestamptz NOT NULL DEFAULT now(),
    status varchar(100),
    stage varchar(100),
    resume_url varchar(255),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Performance Reviews
CREATE TABLE performance_reviews (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id uuid REFERENCES employees(id),
    period varchar(100),
    ratings jsonb DEFAULT '{}'::jsonb,
    average_rating numeric,
    comments text,
    goals jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Training Programs
CREATE TABLE training_programs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(255),
    description text,
    start_date date,
    end_date date,
    instructor varchar(255),
    budget numeric,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Benefits
CREATE TABLE benefits (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(255),
    type varchar(100),
    provider varchar(255),
    cost numeric,
    coverage text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    name varchar(255),
    url varchar(1024),
    type varchar(50),
    uploaded_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id uuid,
    actor_type varchar(50),
    action varchar(255),
    object_type varchar(255),
    object_id uuid,
    data jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Integrations
CREATE TABLE integrations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(255),
    key varchar(255),
    config jsonb DEFAULT '{}'::jsonb,
    enabled boolean DEFAULT false,
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Jobs
CREATE TABLE jobs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    type varchar(255),
    payload jsonb DEFAULT '{}'::jsonb,
    status varchar(50) DEFAULT 'queued',
    attempts int DEFAULT 0,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_employee_number ON employees(employee_number);
CREATE INDEX idx_candidates_email ON candidates(email);

-- Ensure integration names are unique for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_name ON integrations(name);

-- Full text index for candidate resume and notes (optional)
-- CREATE INDEX idx_candidates_ft ON candidates USING GIN (to_tsvector('english', coalesce(resume_url,'') || ' ' || coalesce(notes,'')));
