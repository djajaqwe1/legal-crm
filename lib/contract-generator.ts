import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function generateDraftContract(leadData: { name: string, phone: string, summary: string }) {
  const date = new Date().toLocaleDateString('ru-RU');
  const contractNumber = Math.floor(1000 + Math.random() * 9000);
  
  const content = `
ДОГОВОР ОБ ОКАЗАНИИ ЮРИДИЧЕСКИХ УСЛУГ (ЧЕРНОВИК)
№ ${contractNumber}

г. Алматы                                         "${date}"

ТОО «Конгломерат Алтай», в лице директора Айкимбаева Р., действующего на основании Устава, именуемое в дальнейшем "Исполнитель", с одной стороны, и
${leadData.name}, тел. ${leadData.phone}, именуемый(ая) в дальнейшем "Заказчик", с другой стороны, заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Исполнитель обязуется оказать Заказчику юридические услуги по вопросу: "${leadData.summary}".
1.2. Конкретный перечень действий определяется Сторонами в Приложении №1.

2. СТОИМОСТЬ УСЛУГ
2.1. Предварительная стоимость услуг составляет: [УТОЧНИТЬ ПОСЛЕ КОНСУЛЬТАЦИИ].

3. КОНТАКТЫ СТОРОН
Исполнитель: ТОО «Конгломерат Алтай», БИН 230140001177
Заказчик: ${leadData.name}, ${leadData.phone}

[Электронная подпись / Черновик сформирован AI]
`;

  return { text: content, number: contractNumber };
}

export async function saveContractAsPdf(caseId: string, content: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const fileName = `contract-${caseId}.pdf`;
      const dirPath = path.join(process.cwd(), 'public', 'docs', 'cases', caseId);
      
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      const filePath = path.join(dirPath, fileName);
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);
      
      // Используем системный шрифт Arial для поддержки кириллицы
      const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
      if (fs.existsSync(fontPath)) {
        doc.font(fontPath);
      }
      
      doc.fontSize(12).text(content, {
        align: 'left',
        lineGap: 2
      });
      
      doc.end();
      
      stream.on('finish', () => {
        resolve(`/docs/cases/${caseId}/${fileName}`);
      });
      
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
