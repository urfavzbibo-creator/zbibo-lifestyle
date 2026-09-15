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
  const token = cleanToken(value).replace(/0/g, 'o');
  return token === '568o' || token === 'ahmed' || token === 'ahmad' || token === 'zbibo';
}

function getCenter(word) {
  return {
    x: (word.bbox.x0 + word.bbox.x1) / 2,
    y: (word.bbox.y0 + word.bbox.y1) / 2
  };
}

function groupWordsByRow(words, tolerance = 18) {
  return words.reduce((rows, word) => {
    const y = getCenter(word).y;
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= tolerance);
    if (row) {
      row.words.push(word);
      row.y = row.words.reduce((sum, item) => sum + getCenter(item).y, 0) / row.words.length;
    } else {
      rows.push({ y, words: [word] });
    }
    return rows;
  }, []).sort((first, second) => first.y - second.y);
}

function getDateHeaderWords(words, targetY) {
  const headerWords = words
    .filter((word) => getCenter(word).y < targetY - 25)
    .sort((first, second) => getCenter(first).x - getCenter(second).x);
  const dateWords = [];

  for (let index = 0; index < headerWords.length; index += 1) {
    const first = headerWords[index];
    const parts = [first];
    let nextIndex = index + 1;
    while (nextIndex < headerWords.length && getCenter(headerWords[nextIndex]).x - getCenter(parts[parts.length - 1]).x < 72) {
      parts.push(headerWords[nextIndex]);
      nextIndex += 1;
    }
    const combined = parts.map((part) => part.text).join('').replace(/[|]/g, '1');
    const dateMatch = combined.match(/(\d{1,2})[-/](?:[A-Za-z]{3}|\d{1,2})[-/]\d{2,4}/);
    if (dateMatch) {
      dateWords.push({ ...first, text: dateMatch[0], bbox: { ...first.bbox, x1: parts[parts.length - 1].bbox.x1 } });
      index = nextIndex - 1;
    }
  }

  return dateWords;
}

function parseLooseDateHeaders(text) {
  return [...text.matchAll(/\b\d{1,2}\s*[-/]\s*(?:[A-Za-z]{3}|\d{1,2})\s*[-/]\s*\d{2,4}\b/g)].map((match) => match[0].replace(/\s+/g, ''));
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
  const words = (data.words || []).filter((word) => word.text?.trim() && word.bbox);
  const targetWords = words.filter((word) => isTargetToken(word.text));
  if (!targetWords.length) return [];

  const targetY = targetWords.reduce((sum, word) => sum + getCenter(word).y, 0) / targetWords.length;
  const dateWords = getDateHeaderWords(words, targetY);
  const rowWords = words.filter((word) => Math.abs(getCenter(word).y - targetY) < 40);
  const targetRightEdge = Math.max(...targetWords.map((word) => word.bbox.x1));
  const rowCells = rowWords
    .filter((word) => getCenter(word).x > targetRightEdge + 20)
    .sort((first, second) => getCenter(first).x - getCenter(second).x)
    .map((word) => parseCellValue(word.text))
    .filter(Boolean);
  const detectedDates = dateWords.sort((first, second) => getCenter(first).x - getCenter(second).x);
  const fallbackDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dateTokens = detectedDates.length === rowCells.length
    ? detectedDates.map((word) => word.text)
    : fallbackDays;
  if (rowCells.length < 7) return [];
  const shifts = [];

  dateTokens.slice(0, 7).forEach((dateToken, index) => {
    const parsedCell = rowCells[index];
    if (!parsedCell) return;
    const day = fallbackDays.includes(dateToken) ? dateToken : dateLabelFromToken(dateToken);
    shifts.push({
      day,
      date: dateToken,
      start: parsedCell.isOff ? 0 : parsedCell.start,
      end: parsedCell.isOff ? 0 : parsedCell.end,
      start24: parsedCell.isOff ? 'OFF' : parsedCell.start24,
      end24: parsedCell.isOff ? 'OFF' : parsedCell.end24,
      demanding: false,
      isOffDay: parsedCell.isOff,
      matchedBy: targetWords.some((word) => cleanToken(word.text).replace(/0/g, 'o') === '568o') ? 'HR ID 5680' : 'Ahmed zbibo'
    });
  });

  return shifts;
}

function extractDateTokens(text) {
  return [...text.matchAll(/\b\d{1,2}[-/]\s*[A-Za-z]{3}\s*[-/]\s*\d{2,4}\b/g)].map((match) => match[0].replace(/\s+/g, ''));
}

function parseRotaGridText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const dateTokens = extractDateTokens(text).length ? extractDateTokens(text) : parseLooseDateHeaders(text);
  const targetLine = lines.find((line) => {
    const normalized = cleanToken(line).replace(/568o/g, '5680');
    return normalized.includes('ahmedzbibo') || normalized.includes('5680');
  });
  if (!targetLine || !dateTokens.length) return [];

  const rowValues = [...targetLine.matchAll(/\b(?:off|\d{1,2}(?::\d{2})?)\b/gi)]
    .map((match) => parseCellValue(match[0]))
    .filter(Boolean);
  if (rowValues.length < dateTokens.length) return [];

  const matchedBy = cleanToken(targetLine).replace(/568o/g, '5680').includes('5680') ? 'HR ID 5680' : 'Ahmed zbibo';
  return dateTokens.map((dateToken, index) => {
    const cell = rowValues[index];
    const day = dateLabelFromToken(dateToken);
    return {
      day,
      date: dateToken,
      start: cell.isOff ? 0 : cell.start,
      end: cell.isOff ? 0 : cell.end,
      start24: cell.isOff ? 'OFF' : cell.start24,
      end24: cell.isOff ? 'OFF' : cell.end24,
      demanding: false,
      isOffDay: cell.isOff,
      matchedBy,
      source: targetLine
    };
  });
}

async function prepareImage(file) {
  if (typeof document === 'undefined') return file;
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = URL.createObjectURL(file);
  });
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = (pixels.data[index] * 0.299) + (pixels.data[index + 1] * 0.587) + (pixels.data[index + 2] * 0.114);
    const enhanced = gray > 150 ? 255 : gray < 80 ? 0 : gray;
    pixels.data[index] = enhanced;
    pixels.data[index + 1] = enhanced;
    pixels.data[index + 2] = enhanced;
  }
  context.putImageData(pixels, 0, 0);
  URL.revokeObjectURL(image.src);
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function extractRotaFromImage(file, onProgress = () => {}) {
  const worker = await createWorker('eng', 1, {
    logger: ({ status, progress }) => onProgress({ status, progress })
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1'
    });
    const preparedImage = await prepareImage(file);
    const { data } = await worker.recognize(preparedImage);
    const tableShifts = parseRotaTableData(data);
    const textTableShifts = tableShifts.length ? [] : parseRotaGridText(data.text);
    const shifts = tableShifts.length ? tableShifts : textTableShifts;
    const ignoredLines = data.text.split(/\r?\n/).filter((line) => line.trim()).length - shifts.length;
    return { text: data.text, shifts, ignoredLines, matchedTableRow: tableShifts.length > 0 };
  } finally {
    await worker.terminate();
  }
}
