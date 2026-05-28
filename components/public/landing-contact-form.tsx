"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

export function LandingContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/public/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: `КЛИЕНТ ОСТАВИЛ ЗАЯВКУ ЧЕРЕЗ ФОРМУ:\nИмя: ${name}\nТелефон: ${phone}\n[LEAD_CAPTURE: {"name": "${name}", "phone": "${phone}", "summary": "Заявка через форму на сайте"}]`,
          history: [] 
        }),
      });

      if (!response.ok) throw new Error("Ошибка при отправке");
      
      setIsSuccess(true);
      setName("");
      setPhone("");
    } catch {
      setError("Не удалось отправить заявку. Попробуйте позже.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-white">Заявка принята!</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Рустем Айкимбаев свяжется с вами в ближайшее время. Договор уже формируется.
        </p>
        <Button 
          variant="link" 
          onClick={() => setIsSuccess(false)} 
          className="mt-4 text-zinc-500 hover:text-white"
        >
          Отправить еще одну
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <input 
        type="text" 
        placeholder="Ваше имя" 
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
      />
      <input 
        type="tel" 
        placeholder="Номер телефона" 
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
      />
      <Button 
        type="submit" 
        disabled={isSubmitting}
        className="h-12 bg-white text-zinc-950 hover:bg-zinc-200"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Отправка...
          </>
        ) : "Отправить заявку"}
      </Button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </form>
  );
}
