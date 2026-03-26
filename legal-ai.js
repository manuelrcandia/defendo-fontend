const https = require("https");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { title, summary, userQuestion } = body;
  if (!title) {
    return { statusCode: 400, body: JSON.stringify({ error: "title is required" }) };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  const isQuestion = !!userQuestion;

  const systemPrompt = `Sos el asistente legal de DEFENDO.AR, estudio jurídico argentino especializado en estafas bancarias, prepagas, protección de datos y amparos de salud. 
Respondés de forma empática, clara y no técnica. Nunca prometés resultados. Máximo 2 oraciones por campo. Sin asteriscos ni bullets.`;

  const userPrompt = isQuestion
    ? `Noticia de contexto: "${title}"
Usuario pregunta: "${userQuestion}"

Respondé en JSON exacto sin código markdown:
{
  "explanation": "respuesta empática y orientativa a la pregunta del usuario (max 2 oraciones)",
  "relevance": "por qué esto podría ser relevante para su situación concreta (max 2 oraciones)",
  "guidance": "qué puede hacer ahora como próximo paso (max 1 oración, sin prometer resultados)"
}`
    : `Noticia legal: "${title}"
${summary ? `Resumen: "${summary}"` : ""}

Respondé en JSON exacto sin código markdown:
{
  "explanation": "qué significa esta noticia para una persona común en Argentina (max 2 oraciones)",
  "relevance": "por qué puede importarle a alguien con un reclamo similar (max 2 oraciones)",
  "guidance": "qué podría hacer si se identifica con esta situación (max 1 oración, sin prometer resultados)"
}`;

  const requestData = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(requestData)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.content && parsed.content[0] ? parsed.content[0].text : "";
            // Strip markdown fences if present
            const clean = text.replace(/```json|```/g, "").trim();
            const result = JSON.parse(clean);
            resolve({
              statusCode: 200,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify(result)
            });
          } catch {
            resolve({
              statusCode: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                explanation: "Esta novedad puede ser relevante para personas con situaciones similares en Argentina.",
                relevance: "Si te identificás con este tema, vale la pena analizarlo con un profesional.",
                guidance: "Podés iniciar una consulta sin costo con DEFENDO.AR para saber si aplica a tu caso."
              })
            });
          }
        });
      }
    );
    req.on("error", () => {
      resolve({
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explanation: "Esta novedad puede ser relevante para tu situación.",
          relevance: "Hay casos donde este tipo de hechos genera responsabilidad legal.",
          guidance: "Consultá con un abogado de DEFENDO.AR para una evaluación personalizada."
        })
      });
    });
    req.write(requestData);
    req.end();
  });
};
