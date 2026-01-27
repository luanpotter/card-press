import { useState } from "react";
import { useTemplateStore } from "@/app/store/templates";
import { PageSize } from "@/types/template";
import { Input } from "@/app/components/Input";
import { Select } from "@/app/components/Select";
import { Button } from "@/app/components/Button";

const PAGE_SIZE_OPTIONS = [
  { value: PageSize.A4, label: "A4" },
  { value: PageSize.Letter, label: "Letter" },
];

export function Templates() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplateStore();
  const [name, setName] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>(PageSize.A4);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (name.trim() === "") return;

    if (editingId) {
      updateTemplate(editingId, name, pageSize);
      setEditingId(null);
    } else {
      addTemplate(name, pageSize);
    }
    setName("");
    setPageSize(PageSize.A4);
  };

  const handleEdit = (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (template) {
      setName(template.name);
      setPageSize(template.pageSize);
      setEditingId(id);
    }
  };

  const handleCancel = () => {
    setName("");
    setPageSize(PageSize.A4);
    setEditingId(null);
  };

  return (
    <section>
      <div className="form-row">
        <Input value={name} onChange={setName} placeholder="Template name" />
        <Select
          value={pageSize}
          onChange={(v) => {
            setPageSize(v as PageSize);
          }}
          options={PAGE_SIZE_OPTIONS}
        />
        <Button onClick={handleSubmit} variant="accent">
          {editingId ? "Update" : "Add"}
        </Button>
        {editingId && <Button onClick={handleCancel}>Cancel</Button>}
      </div>

      {templates.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Page Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>{template.name}</td>
                <td>{template.pageSize}</td>
                <td>
                  <div className="actions">
                    <Button
                      onClick={() => {
                        handleEdit(template.id);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => {
                        deleteTemplate(template.id);
                      }}
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {templates.length === 0 && <p className="muted">No templates yet.</p>}
    </section>
  );
}
