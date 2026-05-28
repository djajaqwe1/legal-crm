/**
 * Сервис для интеграции с ИС «Әділет» (adilet.zan.kz)
 */

export interface AdiletDocument {
  id: string;
  title: string;
  url: string;
  date: string;
  type: string;
  snippet?: string;
}

export async function searchAdilet(query: string): Promise<AdiletDocument[]> {
  console.log(`Searching Adilet for: ${query}`);
  
  // В реальном приложении здесь был бы вызов к API или веб-парсинг
  // Для MVP мы имитируем поиск, чтобы показать работу "Стратега"
  
  const mockDocs: AdiletDocument[] = [
    {
      id: "1",
      title: "Гражданский процессуальный кодекс Республики Казахстан",
      url: "https://adilet.zan.kz/rus/docs/K1500000377",
      date: "31.10.2015",
      type: "Кодекс",
      snippet: "Настоящий Кодекс регулирует общественные отношения, возникающие при осуществлении правосудия по гражданским делам..."
    },
    {
      id: "2",
      title: "Гражданский кодекс Республики Казахстан (Общая часть)",
      url: "https://adilet.zan.kz/rus/docs/K940001000_",
      date: "27.12.1994",
      type: "Кодекс",
      snippet: "Гражданским законодательством регулируются товарно-денежные и иные основанные на равенстве участников имущественные отношения..."
    },
    {
      id: "3",
      title: "Закон Республики Казахстан «О жилищных отношениях»",
      url: "https://adilet.zan.kz/rus/docs/Z970000094_",
      date: "16.04.1997",
      type: "Закон",
      snippet: "Настоящий Закон регулирует отношения с участием граждан, юридических лиц, государственных органов, возникающие по поводу оснований возникновения..."
    }
  ];

  // Фильтруем моки по запросу для реалистичности
  return mockDocs.filter(doc => 
    doc.title.toLowerCase().includes(query.toLowerCase()) || 
    doc.snippet?.toLowerCase().includes(query.toLowerCase())
  );
}
