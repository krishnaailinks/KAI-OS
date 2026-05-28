"use client";

import React, { useState, useEffect } from "react";
import { FolderKanban, Plus, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ProjectManagerProps {
  role: "director" | "employee";
}

interface ProjectRecord {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  tasks?: Array<{ count: number }>;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ role }) => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await apiFetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [role]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingProject(true);
    try {
      const res = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName, description: newProjectDesc })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewProjectName("");
        setNewProjectDesc("");
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to create project", err);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleGenerateDoc = async (projectId: string, projectName: string) => {
    setLoadingDoc(projectId);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/generate-doc`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        
        // Trigger download
        const blob = new Blob([data.document_content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(projectName || 'Project').replace(/\s+/g, '_')}_Lifecycle_Doc.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to generate doc", err);
    } finally {
      setLoadingDoc(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Project Management</h2>
          <p className="text-sm text-slate-500 mt-1">Create projects, track tasks, and generate lifecycle documents.</p>
        </div>
        {role === "director" && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-md"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map((p) => (
          <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-500">
                <FolderKanban className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold uppercase">{p.status}</span>
              </div>
            </div>
            <h3 className="text-lg font-bold mb-2">{p.name}</h3>
            <p className="text-sm text-slate-500 mb-6 flex-1">
              {p.tasks?.[0]?.count || 0} active tasks associated with this project.
            </p>
            
            <button 
              onClick={() => handleGenerateDoc(p.id, p.name)}
              disabled={loadingDoc === p.id}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-bold transition-all"
            >
              {loadingDoc === p.id ? (
                <span className="animate-pulse">Generating...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Generate Lifecycle Doc
                </>
              )}
            </button>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No active projects found.
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Project Name</label>
                <input 
                  type="text" 
                  required
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea 
                  required
                  rows={3}
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creatingProject}
                  className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {creatingProject ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
