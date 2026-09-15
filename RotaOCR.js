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
  return token === '5680' || token === '568o' || token === 'ahmed' || token === 'ahmad' || token === 'zbibo';
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
    const second = headerWords[index + 1];
    const combined = `${first.text}${second && getCenter(second).x - getCenter(first).x < 80 ? second.text : ''}`;
    if (DATE_PATTERN.test(combined)) {
      dateWords.push(second && combined.endsWith(second.text) ? { ...first, text: combined, bbox: { ...first.bbox, x1: second.bbox.x1 } } : first);
      if (combined.endsWith(second?.text || '\0')) index += 1;
    } else if (DATE_PATTERN.test(first.text.trim())) {
      dateWords.push(first);
    }
  }

  return dateWords;
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
  if (!dateWords.length) return [];

  const sortedDates = dateWords.sort((first, second) => getCenter(first).x - getCenter(second).x);
  const targetRow = groupWordsByRow(words).sort((first, second) => Math.abs(first.y - targetY) - Math.abs(second.y - targetY))[0];
  const rowWords = targetRow?.words || words.filter((word) => Math.abs(getCenter(word).y - targetY) < 28);
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

function extractDateTokens(text) {
  return [...text.matchAll(/\b\d{1,2}[-/]\s*[A-Za-z]{3}\s*[-/]\s*\d{2,4}\b/g)].map((match) => match[0].replace(/\s+/g, ''));
}

function parseRotaGridText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const dateTokens = extractDateTokens(text);
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

export async function extractRotaFromImage(file, onProgress = () => {}) {
  const worker = await createWorker('eng', 1, {
    logger: ({ status, progress }) => onProgress({ status, progress })
  });
  try {
    const { data } = await worker.recognize(file);
    const tableShifts = parseRotaTableData(data);
    const textTableShifts = tableShifts.length ? [] : parseRotaGridText(data.text);
    const shifts = tableShifts.length ? tableShifts : textTableShifts;
    const ignoredLines = data.text.split(/\r?\n/).filter((line) => line.trim()).length - shifts.length;
    return { text: data.text, shifts, ignoredLines, matchedTableRow: tableShifts.length > 0 };
  } finally {
    await worker.terminate();
  }
}
