-- 06_fix_missing_rls.sql
-- Fixes missing RLS policies identified by QA Audit

-- 1. Tasks table missing policies
CREATE POLICY "Enable insert for authenticated users on tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users on tasks" ON tasks FOR DELETE TO authenticated USING (true);

-- 2. Task history table missing policies
CREATE POLICY "Enable select for authenticated users on task_history" ON task_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on task_history" ON task_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users on task_history" ON task_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users on task_history" ON task_history FOR DELETE TO authenticated USING (true);

-- 3. Personnel permissions missing policies
CREATE POLICY "Enable select for authenticated users on personnel_permissions" ON personnel_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users on personnel_permissions" ON personnel_permissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users on personnel_permissions" ON personnel_permissions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users on personnel_permissions" ON personnel_permissions FOR DELETE TO authenticated USING (true);

-- 4. Employee profiles missing policies
CREATE POLICY "Enable insert for authenticated users on employee_profiles" ON employee_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users on employee_profiles" ON employee_profiles FOR DELETE TO authenticated USING (true);

-- 5. Clients & Invoices missing policies
CREATE POLICY "Enable insert for authenticated users on clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users on clients" ON clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users on clients" ON clients FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users on invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users on invoices" ON invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users on invoices" ON invoices FOR DELETE TO authenticated USING (true);

-- 6. Projects missing policies
CREATE POLICY "Enable delete for authenticated users on projects" ON projects FOR DELETE TO authenticated USING (true);

-- 7. System audit logs missing policies
CREATE POLICY "Enable insert for authenticated users on system_audit_logs" ON system_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
