import { useEffect, useRef } from "react";
import { loadDefaultTemplates } from "@/app/store/loadDefaults";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";
import { Box } from "@/app/components/Box";

export function Home() {
  const { sessions, addSession, getActiveSession } = useSessionStore();
  const { templates, defaultTemplateId } = useTemplateStore();
  const initRef = useRef(false);

  useEffect(() => {
    // Use ref to prevent double initialization in StrictMode
    if (initRef.current) return;

    // If no templates and no sessions, initialize with defaults
    if (templates.length === 0 && sessions.length === 0) {
      initRef.current = true;
      const defaultId = loadDefaultTemplates();
      if (defaultId) {
        addSession({ name: "New Session", templateId: defaultId });
      }
      return;
    }

    // If templates exist but no sessions, create a session
    const firstTemplate = templates[0];
    if (sessions.length === 0 && firstTemplate) {
      initRef.current = true;
      const templateId = defaultTemplateId ?? firstTemplate.id;
      addSession({ name: "New Session", templateId });
    }
  }, [sessions.length, templates, defaultTemplateId, addSession]);

  const activeSession = getActiveSession();
  const activeTemplate = activeSession ? templates.find((t) => t.id === activeSession.templateId) : undefined;

  if (templates.length === 0) {
    return (
      <section>
        <h1>Welcome to Card Press</h1>
        <p className="muted">Get started by creating a template in the Templates page.</p>
      </section>
    );
  }

  if (!activeSession) {
    return (
      <section>
        <h1>Card Press</h1>
        <p className="muted">Loading session...</p>
      </section>
    );
  }

  return (
    <section>
      <Box label="Session">
        <div className="columns">
          <strong>{activeSession.name}</strong>
          <p className="muted">
            {activeTemplate?.name ?? "Unknown"} • {activeTemplate?.slots.length ?? 0} slots
          </p>
        </div>
      </Box>
    </section>
  );
}
