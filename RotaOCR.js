import { createWorker } from 'tesseract.js';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TARGET_NAME_PATTERN = /\bahmed\s+zbibo\b/i;
const TARGET_ID_PATTERN = /\b5680\b/;
const DATE_PATTERN = /^\d{1,2}[-/]([a-z]{3}|\d{1,2})[-/]\d{2,4}$/i;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseRotaText(text) {
  const shifts = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const timePattern = /(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?\s*(?:-|to|–)\s*(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?/i;

  lines.forEach((line, index) => {
    const matchedByName = TARGET_NAME_PATTERN.test(line);
    const matchedByHrId = TARGET_ID_PATTERN.test(line);
    if (!matchedByName && !matchedByHrId) return;
    const match = line.match(timePattern);
    if (!match) return;
    const day = DAY_NAMES.find((name) => line.toLowerCase().includes(name)) || `Day ${index + 1}`;
    const start = toDecimalHour(match[1], match[2], match[3]);
    const end = toDecimalHour(match[4], match[5], match[6] || match[3]);
    if (start !== null && end !== null) {
      shifts.push({
        day,
        start,
        end,
        start24: format24Hour(start),
        end24: format24Hour(end),
        matchedBy: matchedByHrId ? 'HR ID 5680' : 'Ahmed zbibo',
        source: line
      });
    }
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

function format24Hour(decimalHour) {
  const totalMinutes = Math.round(decimalHour * 60) % (24 * 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function cleanToken(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isTargetToken(value) {
  const token = cleanToken(value);
  return token === '5680' || token === 'ahmed' || token === 'ahmad' || token === 'zbibo';
}

function getCenter(word) {
  return {
    x: (word.bbox.x0 + word.bbox.x1) / 2,
    y: (word.bbox.y0 + word.bbox.y1) / 2
  };
}

function parseCellValue(value) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9:]/g, '');
  if (normalized.includes('OFF')) return { isOff: true };
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  const start = toDecimalHour(match[1], match[2]);
  if (start === null) return null;
  const end = (start + 8) % 24;
  return { start, end, start24: format24Hour(start), end24: format24Hour(end) };
}

function dateLabelFromToken(value) {
  const parts = value.replace(/\//g, '-').split('-');
  if (parts.length !== 3) return value;
  const month = MONTHS[parts[1].toLowerCase().slice(0, 3)] ?? Number(parts[1]) - 1;
  const date = new Date(Date.UTC(Number(parts[2].length === 2 ? `20${parts[2]}` : parts[2]), month, Number(parts[0])));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

export function parseRotaTableData(data) {
  const words = (data.words || []).filter((word) => word.text?.trim() && word.confidence >= 20);
  const targetWords = words.filter((word) => isTargetToken(word.text));
  if (!targetWords.length) return [];

  const targetY = targetWords.reduce((sum, word) => sum + getCenter(word).y, 0) / targetWords.length;
  const dateWords = words.filter((word) => DATE_PATTERN.test(word.text.trim()) && getCenter(word).y < targetY);
  if (!dateWords.length) return [];

  const sortedDates = dateWords.sort((first, second) => getCenter(first).x - getCenter(second).x);
  const rowWords = words.filter((word) => Math.abs(getCenter(word).y - targetY) < 20);
  const shifts = [];

  sortedDates.forEach((dateWord, index) => {
    const dateCenter = getCenter(dateWord).x;
    const previousCenter = index ? getCenter(sortedDates[index - 1]).x : dateCenter - (getCenter(sortedDates[1] || dateWord).x - dateCenter);
    const nextCenter = sortedDates[index + 1] ? getCenter(sortedDates[index + 1]).x : dateCenter + (dateCenter - getCenter(sortedDates[index - 1] || dateWord).x);
    const cell = rowWords
      .filter((word) => getCenter(word).x > (previousCenter + dateCenter) / 2 && getCenter(word).x < (dateCenter + nextCenter) / 2)
      .sort((first, second) => getCenter(first).x - getCenter(second).x)
      .map((word) => word.text)
      .join(' ');
    const parsedCell = parseCellValue(cell);
    if (!parsedCell) return;
    const day = dateLabelFromToken(dateWord.text);
    shifts.push({
      day,
      date: dateWord.text,
      start: parsedCell.isOff ? 0 : parsedCell.start,
      end: parsedCell.isOff ? 0 : parsedCell.end,
      start24: parsedCell.isOff ? 'OFF' : parsedCell.start24,
      end24: parsedCell.isOff ? 'OFF' : parsedCell.end24,
      demanding: false,
      isOffDay: parsedCell.isOff,
      matchedBy: targetWords.some((word) => cleanToken(word.text) === '5680') ? 'HR ID 5680' : 'Ahmed zbibo'
    });
  });

  return shifts;
}

export async function extractRotaFromImage(file, onProgress = () => {}) {
  const worker = await createWorker('eng', 1, {
    logger: ({ status, progress }) => onProgress({ status, progress })
  });
  try {
    const { data } = await worker.recognize(file);
    const tableShifts = parseRotaTableData(data);
    const shifts = tableShifts.length ? tableShifts : parseRotaText(data.text);
    const ignoredLines = data.text.split(/\r?\n/).filter((line) => line.trim()).length - shifts.length;
    return { text: data.text, shifts, ignoredLines, matchedTableRow: tableShifts.length > 0 };
  } finally {
    await worker.terminate();
  }
}
