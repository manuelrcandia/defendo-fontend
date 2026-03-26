const https = require("https");

const SOURCES = [
  "https://news.google.com/rss/search?q=estafa+bancaria+Argentina&hl=es-419&gl=AR&ceid=AR:es",
  "https://news.google.com/rss/search?q=prepaga+cobertura+medica+Argentina&hl=es-419&gl=AR&ceid=AR:es",
  "https://news.google.com/rss/search?q=datos+personales+privacidad+Argentina&hl=es-419&gl=AR&ceid=AR:es",
  "https://news.google.com/rss/search?q=amparo+salud+Argentina&hl=es-419&gl=AR&ceid=AR:es"
];

const PROXY = "https://api.rss2json.com/v1/api.json?rss_url=";

const IMAGE_MAP = {
  estafa: "/images/estafa.jpg", fraude: "/images/estafa.jpg",
  banco: "/images/estafa.jpg", homebanking: "/images/estafa.jpg", transferencia: "/images/estafa.jpg",
  prepaga: "/images/salud.jpg", salud: "/images/salud.jpg",
  amparo: "/images/salud.jpg", cobertura: "/images/salud.jpg", medicamento: "/images/salud.jpg",
  datos: "/images/datos.jpg", privacidad: "/images/datos.jpg", habeas: "/images/datos.jpg",
  laboral: "/images/laboral.jpg", despido: "/images/laboral.jpg", indemnización: "/images/laboral.jpg"
};

function detectImage(text) {
  const t = (text || "").toLowerCase();
  for (const [kw, img] of Object.entries(IMAGE_MAP)) {
    if (t.includes(kw)) return img;
  }
  return "/images/datos.jpg";
}

function detectCategory(text) {
  const t = (text || "").toLowerCase();
  if (/estafa|fraude|banco|homebanking|transferencia/.test(t)) return "Estafas bancarias";
  if (/prepaga|cobertura|salud|amparo|medicamento/.test(t)) return "Salud y prepagas";
  if (/datos|privacidad|habeas|nosis|veraz/.test(t)) return "Protección de datos";
  if (/laboral|despido|indemnización/.test(t)) return "Laboral";
  return "Actualidad jurídica";
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

exports.handler = async function () {
  const results = await Promise.allSettled(
    SOURCES.map((src) => fetchUrl(PROXY + encodeURIComponent(src)))
  );

  let items = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value && r.value.items) {
      items = items.concat(r.value.items.slice(0, 2));
    }
  }

  // Deduplicar
  const seen = new Set();
  items = items.filter((i) => {
    const k = (i.title || "").slice(0, 50);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Normalizar
  const normalized = items.slice(0, 6).map((item) => ({
    title: item.title || "",
    summary: item.description ? item.description.replace(/<[^>]+>/g, "").slice(0, 180) : "",
    link: item.link || "#",
    date: item.pubDate || new Date().toISOString(),
    category: detectCategory(item.title),
    image: detectImage(item.title)
  }));

  // Fallback si no hay noticias
  if (!normalized.length) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify([
        { title: "Aumento de estafas bancarias digitales en Argentina", summary: "Transferencias no autorizadas y fraudes electrónicos siguen en alza.", link: "#", date: new Date().toISOString(), category: "Estafas bancarias", image: "/images/estafa.jpg" },
        { title: "Fallos judiciales contra prepagas por falta de cobertura", summary: "La justicia refuerza el derecho a prestaciones médicas esenciales.", link: "#", date: new Date().toISOString(), category: "Salud y prepagas", image: "/images/salud.jpg" },
        { title: "Sanciones por uso indebido de datos personales", summary: "Empresas enfrentan consecuencias por incumplir la Ley 25.326.", link: "#", date: new Date().toISOString(), category: "Protección de datos", image: "/images/datos.jpg" },
        { title: "Despidos irregulares en aumento: claves para reclamar", summary: "Se incrementan los reclamos laborales por desvinculaciones sin causa.", link: "#", date: new Date().toISOString(), category: "Laboral", image: "/images/laboral.jpg" }
      ])
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(normalized)
  };
};
