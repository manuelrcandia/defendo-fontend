# DEFENDO.AR — Guía de despliegue con IA (Claude)

## Archivos que recibís

| Archivo | Para qué sirve |
|---|---|
| `server.js` | El servidor backend que conecta con Claude |
| `package.json` | Lista de dependencias del servidor |
| `.env.example` | Plantilla para configurar tu API key |
| `index_llm.html` | El frontend del sitio con el triage conectado a la IA |
| `DESPLIEGUE.md` | Esta guía |

---

## Paso 1 — Obtener tu API key de Claude (Anthropic)

1. Entrá a **https://console.anthropic.com**
2. Creá una cuenta (podés usar Gmail)
3. En el menú izquierdo, hacé clic en **"API Keys"**
4. Hacé clic en **"Create Key"**, dale un nombre (ej: "DEFENDO") y copiá la clave

> ⚠️ La clave empieza con `sk-ant-`. Guardala en un lugar seguro. No la compartas con nadie y nunca la subas a GitHub.

**Créditos:** Anthropic da $5 USD gratuitos al registrarte. Para una firma chica con tráfico moderado, eso alcanza para cientos de conversaciones. Después podés cargar saldo en la misma consola.

---

## Paso 2 — Configurar el backend en tu servidor

### Opción A: VPS propio (DigitalOcean, Hostinger, etc.)

```bash
# 1. Instalá Node.js (si no lo tenés)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Verificá la versión (debe ser 18 o superior)
node --version

# 3. Creá una carpeta para el backend
mkdir ~/defendo-backend
cd ~/defendo-backend

# 4. Copiá server.js y package.json a esa carpeta
# (podés usar FileZilla, scp, o el gestor de archivos de tu panel)

# 5. Instalá las dependencias
npm install

# 6. Creá el archivo .env con tu API key
cp .env.example .env
nano .env
# → Reemplazá "sk-ant-PEGA-TU-CLAVE-AQUI" con tu clave real
# → Guardá con Ctrl+O y salí con Ctrl+X

# 7. Probá que funciona
node server.js
# Deberías ver: ✅ DEFENDO.AR Backend corriendo en http://localhost:3000
```

### Mantenerlo corriendo (con PM2)

```bash
# Instalá PM2 (gestor de procesos para Node.js)
npm install -g pm2

# Iniciá el servidor con PM2
pm2 start server.js --name defendo-backend

# Que arranque automático al reiniciar el servidor
pm2 startup
pm2 save

# Ver logs en tiempo real
pm2 logs defendo-backend
```

### Opción B: Railway (sin servidor propio, gratis para empezar)

1. Entrá a **https://railway.app** y creá una cuenta con GitHub
2. Creá un nuevo proyecto → **"Deploy from GitHub repo"**
3. Subí `server.js`, `package.json` a un repositorio de GitHub
4. En Railway, configurá la variable de entorno: `CLAUDE_API_KEY=tu_clave`
5. Railway te da una URL pública automáticamente (ej: `https://defendo-backend.up.railway.app`)
6. Anotá esa URL — la vas a necesitar en el paso 4

---

## Paso 3 — Subir el frontend

1. Abrí el archivo `index_llm.html`
2. Buscá esta línea cerca del inicio del script de triage:

```javascript
var DEFENDO_BACKEND_URL = '/api/chat';
```

3. **Si el frontend y el backend están en el mismo servidor** (ej: Nginx con proxy): dejalo como está (`/api/chat`)

4. **Si el backend está en otro servidor o en Railway**: reemplazá por la URL completa:

```javascript
var DEFENDO_BACKEND_URL = 'https://defendo-backend.up.railway.app/api/chat';
```

5. Renombrá el archivo a `index.html` y subilo a tu hosting web (reemplazando el anterior)

---

## Paso 4 — Configurar Nginx como proxy (si usás VPS)

Si el sitio y el backend están en el mismo VPS, agregá esto en tu config de Nginx:

```nginx
server {
    listen 443 ssl;
    server_name defendo.ar;

    # ... tu config SSL existente ...

    # Ruta del frontend
    root /var/www/defendo;
    index index.html;

    # Proxy al backend Node.js
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Después reiniciá Nginx: `sudo nginx -t && sudo systemctl reload nginx`

Con esta config, el frontend llama a `/api/chat` y Nginx lo redirige al backend. No necesitás cambiar nada en el código.

---

## Paso 5 — Verificar que todo funciona

### Test rápido del backend
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "me rajaron del trabajo sin causa"}]}'
```

Deberías recibir un JSON con `"response"` y `"collectedData"`.

### Health check
```
GET https://tu-servidor.com/api/health
```

### Pruebas en el chat del sitio
Probá estos mensajes para verificar que la IA responde correctamente:

| Mensaje | Comportamiento esperado |
|---|---|
| `"me rajaron"` | Pregunta sobre fecha, telegrama, antigüedad |
| `"me estafaron en el banco"` | Pregunta sobre banco, monto, si ya reclamó |
| `"no me cubren el tratamiento"` | Identifica categoría salud, pregunta por prepaga |
| `"boludo no me ayudás"` | Responde con empatía, ignora el insulto |
| `"hijo de puta"` | Responde con firmeza pero sin resetear |
| `"quiero hablar con un abogado ya"` | Ofrece directamente WhatsApp/Agendar/Datos |

---

## Preguntas frecuentes

**¿Qué pasa si la IA no responde?**
El sistema tiene un fallback automático al motor de reglas original. El usuario nunca ve un error — ve una respuesta del motor local.

**¿Se guardan las conversaciones?**
No. El backend no guarda ningún dato. Cada conversación es efímera. Si querés logs, podés agregar un `console.log` en `server.js`.

**¿Cuánto cuesta?**
Claude Sonnet cuesta aproximadamente $3 USD por millón de tokens de entrada y $15 por millón de salida. Una conversación de 10 turnos promedio consume ~2.000 tokens. Eso es menos de $0,01 por conversación.

**¿Se puede usar con Qwen o DeepSeek en lugar de Claude?**
Sí. Cambiá la llamada en `server.js` por el SDK correspondiente. Pero Claude tiene la mejor comprensión del español argentino entre los modelos disponibles.

**¿Cómo actualizo el prompt?**
Editá la constante `SYSTEM_PROMPT` en `server.js` y reiniciá el servidor con `pm2 restart defendo-backend`.

---

## Soporte

Si algo no funciona, revisá los logs:
```bash
pm2 logs defendo-backend --lines 50
```

Los errores más comunes:
- `401 Unauthorized` → tu API key está mal o venció
- `ECONNREFUSED` → el backend no está corriendo
- `CORS error` → configurá `ALLOWED_ORIGIN` en `.env` con tu dominio
