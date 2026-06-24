import { NextResponse } from 'next/server';
import { requireDirector, jsonError } from '@/lib/server/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { adminDb } = await requireDirector(req);
    const { id: projectId } = await params;
    
    const { data: project, error: projectError } = await adminDb
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    const { data: tasks, error: tasksError } = await adminDb
      .from('tasks')
      .select('*, profiles(full_name)')
      .eq('project_id', projectId);

    if (tasksError) throw tasksError;

    // Fetch task history for these tasks
    const taskIds = tasks?.map(t => t.id) || [];
    let history: Array<{ task_id: string; timestamp: string; action: string; agent_id?: string | null }> = [];
    if (taskIds.length > 0) {
      const { data } = await adminDb
        .from('task_history')
        .select('*')
        .in('task_id', taskIds);
      history = data || [];
    }

    const projectName = project?.name || 'Mock Project';
    
    let markdown = `# Project Lifecycle Document: ${projectName}\n\n`;
    markdown += `Generated on: ${new Date().toISOString()}\n`;
    markdown += `Status: ${project?.status || 'Unknown'}\n\n`;
    
    markdown += `## Executive Summary\n`;
    markdown += `${project?.description || 'No description provided.'}\n\n`;

    markdown += `## Tasks Breakdown\n`;
    if (!tasks || tasks.length === 0) {
      markdown += `No tasks found for this project.\n`;
    } else {
      tasks.forEach(task => {
        markdown += `### Task: ${task.title} (ID: ${task.id})\n`;
        markdown += `- **Status**: ${task.status}\n`;
        markdown += `- **Progress**: ${task.progress}%\n`;
        markdown += `- **Assignee**: ${task.profiles?.full_name || 'Unassigned'}\n`;
        
        const taskHistory = history.filter(h => h.task_id === task.id);
        if (taskHistory.length > 0) {
          markdown += `\n**Audit Trail:**\n`;
          taskHistory.forEach(h => {
             markdown += `  - [${new Date(h.timestamp).toLocaleString()}] Action: ${h.action} by Agent/User ID: ${h.agent_id || 'System'}\n`;
          });
        }
        markdown += `\n`;
      });
    }

    return NextResponse.json({ document_content: markdown });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
