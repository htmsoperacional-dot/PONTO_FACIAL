
import { GoogleGenAI, Type } from "@google/genai";
import { Employee } from "../types";

// Always use process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const identifyEmployee = async (base64Image: string, registeredEmployees: Employee[]) => {
  if (registeredEmployees.length === 0) {
    return { error: "Nenhum funcionário cadastrado no sistema." };
  }

  // We send the live image as the first part
  const parts: any[] = [
    { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
    { text: "A primeira imagem é uma captura ao vivo de um funcionário batendo o ponto. As imagens a seguir são as fotos de referência dos funcionários cadastrados. Compare a primeira imagem com as de referência e identifique quem é a pessoa. Se houver uma correspondência clara, retorne o ID e o Nome. Se não houver correspondência ou se a pessoa não for reconhecida, retorne 'identified: false'." }
  ];

  // Add reference photos of each employee
  registeredEmployees.forEach(emp => {
    parts.push({ text: `Funcionário: ${emp.name} (ID: ${emp.id})` });
    parts.push({ inlineData: { data: emp.photoUrl, mimeType: "image/jpeg" } });
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            employeeId: { type: Type.STRING, description: "ID do funcionário identificado" },
            employeeName: { type: Type.STRING, description: "Nome do funcionário identificado" },
            confidence: { type: Type.NUMBER, description: "Confiança na identificação (0-1)" },
            identified: { type: Type.BOOLEAN, description: "Se o funcionário foi reconhecido com sucesso" },
            reason: { type: Type.STRING, description: "Breve explicação da decisão" }
          },
          required: ["identified"]
        }
      }
    });

    // response.text is a property, not a method
    const result = JSON.parse(response.text || '{}');
    return result;
  } catch (error) {
    console.error("Gemini Recognition Error:", error);
    return { error: "Erro crítico no processamento de reconhecimento facial." };
  }
};
