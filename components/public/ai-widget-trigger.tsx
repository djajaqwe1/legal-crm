"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AiSalesWidget } from "@/components/public/ai-sales-widget";

export function AiWidgetTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        size="lg"
        className="h-12 rounded-full bg-white px-8 text-zinc-950 hover:bg-zinc-200"
        onClick={() => setIsOpen(true)}
      >
        Бесплатная консультация
      </Button>
      <AiSalesWidget isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  );
}
