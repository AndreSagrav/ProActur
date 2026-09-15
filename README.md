# ProActur AI 🎙️⚡

> **Tu asistente proactivo de reuniones, transcriptor inteligente y segundo cerebro conectado directamente con Notion.**

ProActur AI es una plataforma diseñada para automatizar la captura, síntesis y seguimiento de reuniones ejecutivas, llamadas y clases. Escucha el audio, extrae minutas estructuradas, identifica acuerdos clave, genera listas de tareas asignadas con responsables y fechas límite, y sincroniza todo con un clic en tu espacio de trabajo de **Notion**.

---

## ✨ Características Principales

* 🎙️ **Captura en Vivo y Archivos:** Graba directamente desde el micrófono de tu navegador o sube grabaciones de audio (`.mp3`, `.wav`, `.m4a`, `.webm`, `.mp4`).
* ⚡ **Transcripción y Análisis con IA:** Utiliza **Gemini 2.0 Flash** para procesar audio nativo a alta velocidad y bajo costo.
* 🎯 **Extracción Ejecutiva Estructurada:**
  * **Resumen Ejecutivo:** Síntesis clara de los puntos tratados.
  * **Decisiones Clave:** Acuerdos tomados durante la conversación.
  * **Compromisos y Tareas (Action Items):** Asignación automática con responsable, nivel de prioridad y fecha límite.
  * **Consejos Proactivos:** Alertas estratégicas, riesgos no contemplados y recomendaciones.
* 🧠 **Segundo Cerebro (Second Brain):** Chat interactivo que indexa todo el historial de reuniones para responder preguntas cruzadas (*ej. "¿Qué acordamos sobre el presupuesto en la última reunión?"*).
* 📝 **Sincronización Nativa con Notion:** Exporta la minuta en bloques enriquecidos (Callouts, Tareas con casillas `to_do`, listas y toggles) a tu base de datos o página de Notion.

---

## 🚀 Inicio Rápido

### 1. Clonar o acceder al proyecto
```bash
cd "c:\Users\Taller SK\Documents\PROYECTOS\proactur"
```

### 2. Configurar Variables de Entorno
Copia el archivo `.env.example` a `.env` y configura tus claves:

```env
PORT=3001

# Clave de Google AI Studio (Gratis en https://aistudio.google.com/)
GEMINI_API_KEY=tu_gemini_api_key_aqui

# Integración con Notion (https://www.notion.so/my-integrations)
NOTION_API_KEY=secret_tu_token_aqui
NOTION_DATABASE_ID=id_de_tu_base_de_datos_o_pagina
```

### 3. Instalar Dependencias
```bash
# Dependencias del servidor y herramientas
npm install

# Dependencias del cliente (React + Vite)
npm --prefix client install
```

### 4. Ejecutar en Modo Desarrollo
```bash
npm run dev
```

* **Frontend:** [http://localhost:5173](http://localhost:5173)
* **Backend API:** [http://localhost:3001](http://localhost:3001)

---

## 📂 Estructura del Proyecto

```
proactur/
├── client/                     # Frontend moderno con React, Vite y Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioRecorder.jsx    # Grabador con ondas y carga de audio
│   │   │   ├── MeetingDetails.jsx   # Vista de minuta, tareas y exportador
│   │   │   ├── SecondBrainModal.jsx # Chat con la memoria de reuniones
│   │   │   └── SettingsModal.jsx    # Verificador de credenciales
│   │   ├── App.jsx                  # Panel principal
│   │   └── index.css                # Estilos globales y Tailwind v4
│   └── vite.config.js               # Proxy hacia Express y plugins
├── server/                     # Backend API con Node.js y Express
│   ├── index.js                # Servidor principal
│   ├── routes/
│   │   └── api.js              # Endpoints de reuniones, audio, Notion y Segundo Cerebro
│   ├── services/
│   │   ├── aiService.js        # Procesamiento y prompts con Gemini Flash
│   │   ├── notionService.js    # Bloques y llamadas a Notion SDK
│   │   └── storageService.js   # Persistencia local de reuniones
│   └── data/
│       └── meetings.json       # Base de datos local de reuniones
├── uploads/                    # Almacenamiento temporal de audios
├── .env.example                # Plantilla de configuración
├── package.json
└── README.md
```

---

## 🔗 Repositorio en GitHub

* **Organización / Usuario:** [AndreSagrav](https://github.com/AndreSagrav)
* **Repositorio:** [https://github.com/AndreSagrav/proactur](https://github.com/AndreSagrav/proactur)

Para enviar tus cambios a GitHub:
```bash
git add .
git commit -m "feat: ProActur AI inicial con integración a Notion y Gemini"
git push -u origin main
```

---

## 📄 Licencia

MIT © [AndreSagrav](https://github.com/AndreSagrav)
