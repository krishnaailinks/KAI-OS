-- Migration 005: Unique constraint on invoices.task_id
-- Run AFTER 004_realtime_publications.sql
--
-- Without this constraint, two concurrent PATCH /api/tasks/[id] requests
-- for the same task reaching COMPLETED simultaneously both pass the
-- "existingInvoice = null" check and insert duplicate invoices (TOCTOU race).
--
-- The DB-level constraint is the only reliable fix:
-- PostgreSQL evaluates the constraint atomically, so exactly one of the two
-- concurrent inserts wins and the other gets a 23505 unique_violation error,
-- which the application catches and treats as a no-op.
--
-- NULL values: PostgreSQL does NOT treat NULLs as equal in UNIQUE constraints,
-- so rows with task_id = NULL (invoices not tied to a task) are unaffected.

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_task_id_unique UNIQUE (task_id);
