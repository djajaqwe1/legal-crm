"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { AiSalesWidget } from "@/components/public/ai-sales-widget";
import { LandingContactForm } from "@/components/public/landing-contact-form";
import { Scale, Shield, FileText, Users, Award, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const [isAiOpen, setIsAiOpen] = useState(false);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-zinc-950 py-24 text-white lg:py-32">
        <div className="absolute inset-0 z-0 opacity-20">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-blue-600 blur-[120px]" />
          <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-indigo-600 blur-[120px]" />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm font-medium text-blue-400">
              <Shield className="mr-2 h-4 w-4" />
              Защита ваших интересов в РК
            </div>
            <h1 className="mt-8 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Рустем Айкимбаев
              <span className="block text-zinc-400">Экспертное представительство в суде</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-400">
              ТОО «Конгломерат Алтай» — инновационный подход к юридическим спорам. Мы объединяем многолетний опыт и современные технологии LegalTech для достижения результата.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <Button 
                size="lg" 
                className="h-12 rounded-full bg-white px-8 text-zinc-950 hover:bg-zinc-200"
                onClick={() => setIsAiOpen(true)}
              >
                Бесплатная консультация
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-full border-zinc-800 bg-zinc-900 px-8 text-white hover:bg-zinc-800">
                Посмотреть кейсы
              </Button>
              <Link
                href="/portal"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "inline-flex h-12 rounded-full border-zinc-700 bg-transparent px-8 text-white hover:bg-zinc-900",
                )}
              >
                Личный кабинет
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Специализация</h2>
            <p className="mt-4 text-zinc-600">Широкий спектр юридических услуг для бизнеса и частных лиц</p>
          </div>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { 
                title: "Гражданские споры", 
                desc: "Защита прав собственности, взыскание долгов и договорные обязательства.",
                icon: Scale
              },
              { 
                title: "Хозяйственные дела", 
                desc: "Арбитражные споры между юридическими лицами и защита бизнеса.",
                icon: FileText
              },
              { 
                title: "Семейное право", 
                desc: "Раздел имущества, алименты и сложные бракоразводные процессы.",
                icon: Users
              },
              { 
                title: "Представительство", 
                desc: "Участие во всех судебных инстанциях Республики Казахстан.",
                icon: Award
              },
              { 
                title: "LegalTech аудит", 
                desc: "Внедрение систем автоматизации юридических процессов для компаний.",
                icon: Shield
              },
              { 
                title: "Договорная работа", 
                desc: "Разработка сложных контрактов и проверка юридической чистоты сделок.",
                icon: CheckCircle2
              }
            ].map((service, i) => (
              <div key={i} className="group relative rounded-2xl border border-zinc-100 bg-zinc-50 p-8 transition-all hover:shadow-lg">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 text-white transition-transform group-hover:scale-110">
                  <service.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">{service.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section id="results" className="py-24 bg-zinc-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Более 190 положительных оценок</h2>
              <p className="mt-6 text-lg text-zinc-600 leading-relaxed">
                За годы практики мы помогли сотням клиентов восстановить справедливость и защитить свои активы. Наша репутация подтверждена реальными результатами и отзывами.
              </p>
              <div className="mt-10 space-y-4">
                {[
                  "95% выигранных дел в судах первой инстанции",
                  "Свыше 1 млрд тенге взыскано в пользу клиентов",
                  "Работаем по всему Казахстану и в СНГ"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-zinc-900">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="h-48 rounded-2xl bg-zinc-900 p-6 text-white flex flex-col justify-end">
                  <p className="text-3xl font-bold">10+</p>
                  <p className="text-sm text-zinc-400">Лет практики</p>
                </div>
                <div className="h-64 rounded-2xl bg-blue-600 p-6 text-white flex flex-col justify-between">
                  <div className="text-4xl">⚖️</div>
                  <div>
                    <p className="text-2xl font-bold">190+</p>
                    <p className="text-sm text-blue-200">Положительных отзывов от клиентов</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="h-64 rounded-2xl bg-indigo-950 p-6 text-white flex flex-col justify-between">
                  <div className="text-4xl">🏆</div>
                  <div>
                    <p className="text-2xl font-bold">95%</p>
                    <p className="text-sm text-indigo-300">Побед в судах первой инстанции</p>
                  </div>
                </div>
                <div className="h-48 rounded-2xl bg-zinc-100 p-6 flex flex-col justify-end dark:bg-zinc-800">
                  <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">500+</p>
                  <p className="text-sm text-zinc-500">Успешных дел</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Основатель и эксперт</h2>
          <div className="mt-12 flex flex-col items-center">
            <div className="h-32 w-32 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-600 mb-6 flex items-center justify-center shadow-xl">
              <span className="text-4xl font-bold text-white tracking-tight">РА</span>
            </div>
            <h3 className="text-2xl font-bold">Рустем Айкимбаев</h3>
            <p className="text-zinc-500 mt-2 italic">Юрист, представитель в суде</p>
            <div className="mt-8 flex gap-4">
              <a href="https://www.instagram.com/rustemaikimbaev/" target="_blank" className="text-sm text-blue-600 hover:underline">Instagram</a>
              <a href="https://www.tiktok.com/@rustem.aik_" target="_blank" className="text-sm text-blue-600 hover:underline">TikTok</a>
              <a href="https://www.linkedin.com/in/рустем-айкимбаев-788b9180/" target="_blank" className="text-sm text-blue-600 hover:underline">LinkedIn</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contacts" className="py-24 bg-zinc-950 text-white">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Готовы решить ваш вопрос?</h2>
          <p className="mt-4 text-zinc-400">Оставьте заявку, и мы проанализируем ваше дело в течение 2 часов.</p>
          <div className="mt-10 max-w-md mx-auto">
            <LandingContactForm />
          </div>
        </div>
      </section>

      {/* AI Widget */}
      <AiSalesWidget isOpen={isAiOpen} setIsOpen={setIsAiOpen} />
    </div>
  );
}
