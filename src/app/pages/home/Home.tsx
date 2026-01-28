import { useEffect, useRef } from "react";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";

export function Home() {
  const { sessions, addSession, getActiveSession } = useSessionStore();
  const { templates, defaultTemplateId } = useTemplateStore();
  const creatingRef = useRef(false);

  useEffect(() => {
    // Auto-create a session if none exists and templates are available
    // Use ref to prevent double creation in StrictMode
    const firstTemplate = templates[0];
    if (sessions.length === 0 && firstTemplate && !creatingRef.current) {
      creatingRef.current = true;
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
      <h1>{activeSession.name}</h1>
      <p className="muted">
        Template: {activeTemplate?.name ?? "Unknown"} • {activeTemplate?.slots.length ?? 0} slots
      </p>
    </section>
  );
}
