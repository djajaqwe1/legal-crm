"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CheckCircle2, FileText, Loader2, Upload, Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string | Date | null;
};

type Document = {
  id: string;
  name: string;
  path: string;
  createdAt?: string | Date;
};

export function DocumentItem({ doc }: { doc: Document }) {
  const isLocal = doc.path.startsWith("/uploads/");
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
        <p className="text-sm font-medium truncate">{doc.name}</p>
      </div>
      {isLocal && (
        <a
          href={doc.path}
          target="_blank"
          rel="noopener noreferrer"
          download={doc.name}
          className="ml-2 shrink-0"
        >
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Скачать">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </a>
      )}
    </div>
  );
}

export function TaskItem({ task }: { task: Task }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function toggleTask() {
    setIsUpdating(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function deleteTask() {
    if (!confirm(`Удалить задачу "${task.title}"?`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      router.refresh();
    } catch (error) {
      console.error(error);
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 transition-colors group">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTask}
          disabled={isUpdating || isDeleting}
          className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
            task.completed
              ? "bg-green-500 border-green-500 text-white"
              : "bg-white border-zinc-300 text-transparent hover:border-zinc-400"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <div>
          <p className={`text-sm font-medium ${task.completed ? "line-through text-zinc-400" : ""}`}>
            {task.title}
          </p>
          <p className="text-[10px] text-zinc-400">
            Срок:{" "}
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString("ru-RU") : "Не указан"}
          </p>
        </div>
      </div>
      <button
        onClick={deleteTask}
        disabled={isDeleting || isUpdating}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50"
        title="Удалить задачу"
      >
        {isDeleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

export function AddTaskDialog({ caseId }: { caseId: string }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  async function handleAddTask() {
    if (!title) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/cases/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, title, dueDate }),
      });
      if (res.ok) {
        setIsOpen(false);
        setTitle("");
        setDueDate("");
        router.refresh();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Добавить задачу
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая задача</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Что нужно сделать?</label>
            <Input 
              placeholder="Напр: Подготовить ходатайство" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Срок (необязательно)</label>
            <Input 
              type="date" 
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handleAddTask} disabled={isLoading || !title}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Сохранить задачу
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddDocumentDialog({ caseId }: { caseId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("caseId", caseId);
      form.append("file", file);
      const res = await fetch("/api/cases/documents/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Ошибка загрузки");
        return;
      }
      setIsOpen(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("Сетевая ошибка при загрузке файла");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        setIsOpen(v);
        if (!v) {
          setFile(null);
          setError(null);
          if (fileRef.current) fileRef.current.value = "";
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Загрузить файл
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Загрузить документ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div
            className="rounded-lg border-2 border-dashed border-zinc-200 p-6 text-center cursor-pointer hover:border-zinc-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileText className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
            {file ? (
              <div>
                <p className="text-sm font-medium text-zinc-900 truncate">{file.name}</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {(file.size / 1024).toFixed(0)} КБ
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-zinc-500">Нажмите для выбора файла</p>
                <p className="text-[10px] text-zinc-400 mt-1">PDF, Word, Excel, JPG, PNG до 10 МБ</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={isLoading || !file}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Загружается…" : "Загрузить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
