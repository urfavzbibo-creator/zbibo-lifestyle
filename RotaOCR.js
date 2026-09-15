import { createWorker } from 'tesseract.js';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function parseRotaText(text) {
  const shifts = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const timePattern = /(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?\s*(?:-|to|–)\s*(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?/i;

  lines.forEach((line, index) => {
    const match = line.match(timePattern);
    if (!match) return;
    const day = DAY_NAMES.find((name) => line.toLowerCase().includes(name)) || `Day ${index + 1}`;
    const start = toDecimalHour(match[1], match[2], match[3]);
    const end = toDecimalHour(match[4], match[5], match[6] || match[3]);
    if (start !== null && end !== null) shifts.push({ day, start, end, source: line });
  });

  return shifts;
}

function toDecimalHour(hour, minute = '00', period) {
  let numericHour = Number(hour);
  const numericMinute = Number(minute || 0);
  if (numericHour > 23 || numericMinute > 59) return null;
  if (period?.toLowerCase() === 'pm' && numericHour < 12) numericHour += 12;
  if (period?.toLowerCase() === 'am' && numericHour === 12) numericHour = 0;
  return numericHour + numericMinute / 60;
}

export async function extractRotaFromImage(file, onProgress = () => {}) {
  const worker = await createWorker('eng', 1, {
    logger: ({ status, progress }) => onProgress({ status, progress })
  });
  try {
    const { data: { text } } = await worker.recognize(file);
    return { text, shifts: parseRotaText(text) };
  } finally {
    await worker.terminate();
  }
}
