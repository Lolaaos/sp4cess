// SP4CE Store - Configuración de Administradores
export const ADMIN_IDS = [
  "269902224732192768", // Tu ID principal
  "884858860291117066"  // Otro admin
];

// URL del webhook de Discord para notificaciones de compra
export const PURCHASE_WEBHOOK_URL =
  process.env.DISCORD_PURCHASE_WEBHOOK ||
  "https://discord.com/api/webhooks/1505336716612079636/Z5Xit34G-p5Qh4zuTbw2kgXlEKJK3hTkXiYb5u1yaASxURwv9SVIZPm2SVVFmNLoYJn9";
