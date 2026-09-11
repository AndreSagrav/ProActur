const { Client } = require('@notionhq/client');

class NotionService {
  constructor() {
    this.apiKey = process.env.NOTION_API_KEY || '';
    this.databaseId = process.env.NOTION_DATABASE_ID || '';
  }

  getClient(apiKeyOverride) {
    const key = apiKeyOverride || this.apiKey || process.env.NOTION_API_KEY;
    if (!key) {
      throw new Error('NOTION_API_KEY no está configurada.');
    }
    return new Client({ auth: key });
  }

  /**
   * Verificar credenciales de Notion
   */
  async testConnection(apiKey, databaseId) {
    try {
      const notion = this.getClient(apiKey);
      const targetDb = databaseId || this.databaseId || process.env.NOTION_DATABASE_ID;

      // Intentar listar usuarios o consultar el database
      const user = await notion.users.me({});
      let dbInfo = null;

      if (targetDb) {
        try {
          dbInfo = await notion.databases.retrieve({ database_id: targetDb });
        } catch (dbErr) {
          // Quizá es un page_id en vez de database_id
          try {
            dbInfo = await notion.pages.retrieve({ page_id: targetDb });
          } catch (pErr) {
            console.warn('No se pudo verificar el database/page ID:', pErr.message);
          }
        }
      }

      return {
        success: true,
        user: user.name || user.id,
        connectedTo: dbInfo ? (dbInfo.title?.[0]?.plain_text || 'Página / Base de datos conectada') : 'Conexión válida (sin base de datos vinculada)'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear página o registro de reunión en Notion
   */
  async syncMeetingToNotion(meeting, options = {}) {
    const apiKey = options.apiKey || this.apiKey || process.env.NOTION_API_KEY;
    const dbId = options.databaseId || this.databaseId || process.env.NOTION_DATABASE_ID;

    if (!apiKey) {
      throw new Error('Se requiere NOTION_API_KEY para sincronizar.');
    }
    if (!dbId) {
      throw new Error('Se requiere NOTION_DATABASE_ID o el ID de la página principal de Notion.');
    }

    const notion = this.getClient(apiKey);

    // Construir bloques de contenido de Notion
    const blocks = [];

    // 1. Resumen ejecutivo en Callout
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [
          {
            type: 'text',
            text: { content: `💡 Resumen Ejecutivo:\n${meeting.summary || 'Sin resumen registrado.'}` }
          }
        ],
        icon: { emoji: '⚡' },
        color: 'gray_background'
      }
    });

    // 2. Decisiones clave
    if (meeting.keyDecisions && meeting.keyDecisions.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '🎯 Decisiones Clave' } }]
        }
      });

      for (const dec of meeting.keyDecisions) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: dec } }]
          }
        });
      }
    }

    // 3. Tareas y Compromisos (Action Items como To-Do)
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '✅ Tareas y Compromisos (Action Items)' } }]
        }
      });

      for (const item of meeting.actionItems) {
        const priorityTag = item.priority ? `[Prioridad: ${item.priority}] ` : '';
        const assigneeTag = item.assignee ? ` - Resp: ${item.assignee}` : '';
        const deadlineTag = item.deadline ? ` (Límite: ${item.deadline})` : '';

        blocks.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [
              {
                type: 'text',
                text: { content: `${priorityTag}${item.task}${assigneeTag}${deadlineTag}` }
              }
            ],
            checked: false
          }
        });
      }
    }

    // 4. Recomendaciones Proactivas de la IA
    if (meeting.proactiveAdvice && meeting.proactiveAdvice.length > 0) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '🧠 Consejos Proactivos' } }]
        }
      });

      for (const adv of meeting.proactiveAdvice) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: adv } }]
          }
        });
      }
    }

    // 5. Transcripción o notas completas (en bloque Toggle para no saturar)
    if (meeting.transcript) {
      // Notion tiene límite de 2000 caracteres por bloque de texto, seccionamos si es largo
      const chunks = this.splitIntoChunks(meeting.transcript, 1800);
      blocks.push({
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: [{ type: 'text', text: { content: '📝 Transcripción Completa de la Reunión' } }],
          children: chunks.map(chunk => ({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: chunk } }]
            }
          }))
        }
      });
    }

    // Intentar crear como fila de base de datos o como subpágina
    try {
      const response = await notion.pages.create({
        parent: { database_id: dbId },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: meeting.title || 'Reunión sin título'
                }
              }
            ]
          }
        },
        children: blocks
      });

      return {
        success: true,
        id: response.id,
        url: response.url,
        message: 'Reunión exportada exitosamente a Notion'
      };
    } catch (dbError) {
      // Si falló con database_id, intentar como subpágina bajo page_id
      try {
        const response = await notion.pages.create({
          parent: { page_id: dbId },
          properties: {
            title: [
              {
                text: {
                  content: meeting.title || 'Reunión sin título'
                }
              }
            ]
          },
          children: blocks
        });

        return {
          success: true,
          id: response.id,
          url: response.url,
          message: 'Reunión exportada exitosamente como página en Notion'
        };
      } catch (pageError) {
        throw new Error(`Error al crear en Notion: ${dbError.message} (o como página: ${pageError.message})`);
      }
    }
  }

  splitIntoChunks(str, size) {
    const numChunks = Math.ceil(str.length / size);
    const chunks = new Array(numChunks);
    for (let i = 0, c = 0; i < numChunks; ++i, c += size) {
      chunks[i] = str.substr(c, size);
    }
    return chunks;
  }
}

module.exports = new NotionService();
