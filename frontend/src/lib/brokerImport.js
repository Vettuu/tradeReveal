function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return []
  }

  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? ''
      return row
    }, {})
  })
}

function parseNumber(value) {
  if (!value) return null
  const normalized = value.replace(/"/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(value) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const [month, day, year] = value.split('/')
  if (!month || !day || !year) {
    return ''
  }

  return `${year.padStart(4, '20').slice(-4)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseTime(value) {
  if (!value) return ''
  const parts = value.split(' ')
  return parts[1]?.slice(0, 5) ?? ''
}

function parseTimestamp(value) {
  if (!value) return null
  const [datePart, timePart] = value.split(' ')
  if (!datePart || !timePart) return null

  const [month, day, year] = datePart.split('/')
  if (!month || !day || !year) return null

  return `${year.padStart(4, '20').slice(-4)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`
}

function parseOffsetMinutes(offsetLabel) {
  const match = offsetLabel.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!match) return 0

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2] || 0)
  const minutes = Number(match[3] || 0)
  return sign * (hours * 60 + minutes)
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  })
  const offsetLabel = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT'
  return parseOffsetMinutes(offsetLabel)
}

function zonedDateTimeToUtc(date, time, timeZone) {
  if (!date || !time) return null

  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }

  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes)
  const firstOffset = getTimeZoneOffsetMinutes(timeZone, new Date(utcGuess))
  const firstPass = utcGuess - (firstOffset * 60 * 1000)
  const secondOffset = getTimeZoneOffsetMinutes(timeZone, new Date(firstPass))
  return new Date(utcGuess - (secondOffset * 60 * 1000))
}

function convertTimeBetweenZones(date, time, fromTimeZone, toTimeZone) {
  const utcDate = zonedDateTimeToUtc(date, time, fromTimeZone)
  if (!utcDate) return ''

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: toTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return formatter.format(utcDate)
}

function compareTimestampAsc(left, right) {
  return (parseTimestamp(left) || '').localeCompare(parseTimestamp(right) || '')
}

function compareTimestampDesc(left, right) {
  return (parseTimestamp(right) || '').localeCompare(parseTimestamp(left) || '')
}

function detectFileType(rows) {
  const firstRow = rows[0] ?? {}

  if ('Position ID' in firstRow && 'Trade Date' in firstRow) {
    return 'position-history'
  }

  if ('Order ID' in firstRow && 'Fill Time' in firstRow) {
    return 'orders'
  }

  return 'unknown'
}

function summarizePositionGroup(group) {
  const firstRow = group[0] ?? {}
  const totalQuantity = group.reduce((sum, row) => sum + (parseNumber(row['Paired Qty']) ?? 0), 0)
  const weightedBuyValue = group.reduce(
    (sum, row) => sum + ((parseNumber(row['Buy Price']) ?? 0) * (parseNumber(row['Paired Qty']) ?? 0)),
    0,
  )
  const weightedSellValue = group.reduce(
    (sum, row) => sum + ((parseNumber(row['Sell Price']) ?? 0) * (parseNumber(row['Paired Qty']) ?? 0)),
    0,
  )
  const firstBoughtAt = group
    .map((row) => row['Bought Timestamp'])
    .filter(Boolean)
    .sort(compareTimestampAsc)[0] ?? ''
  const lastSoldAt = group
    .map((row) => row['Sold Timestamp'])
    .filter(Boolean)
    .sort(compareTimestampDesc)[0] ?? ''
  const isShort = firstBoughtAt && lastSoldAt && parseTimestamp(lastSoldAt) < parseTimestamp(firstBoughtAt)
  const entryPrice = isShort
    ? (totalQuantity ? weightedSellValue / totalQuantity : null)
    : (totalQuantity ? weightedBuyValue / totalQuantity : null)
  const exitPrice = isShort
    ? (totalQuantity ? weightedBuyValue / totalQuantity : null)
    : (totalQuantity ? weightedSellValue / totalQuantity : null)
  const resultAmount = group.reduce((sum, row) => sum + (parseNumber(row['P/L']) ?? 0), 0)

  return {
    brokerPositionId: firstRow['Position ID'] ?? '',
    contractName: firstRow.Contract ?? '',
    tradeDate: parseDate(firstRow['Trade Date']),
    timeIt: parseTime(isShort ? lastSoldAt : firstBoughtAt),
    timeNy: convertTimeBetweenZones(
      parseDate(firstRow['Trade Date']),
      parseTime(isShort ? lastSoldAt : firstBoughtAt),
      'Europe/Rome',
      'America/New_York',
    ),
    lots: String(totalQuantity || ''),
    direction: isShort ? 'short' : 'long',
    setupName: '',
    entryPrice: entryPrice !== null ? String(entryPrice.toFixed(2)) : '',
    exitPrice: exitPrice !== null ? String(exitPrice.toFixed(2)) : '',
    stopLoss: '',
    riskAmount: '',
    notes: `Importato da Position History.csv (${group.length} righe aggregate)`,
    account: firstRow.Account ?? '',
    redNews: false,
    resultAmount,
    sourceLabel: `Position ${firstRow['Position ID'] ?? ''}`.trim(),
  }
}

function mapPositionHistoryRows(rows) {
  const groups = rows.reduce((accumulator, row) => {
    const key = row['Position ID'] || row['Pair ID'] || `row-${accumulator.size + 1}`

    if (!accumulator.has(key)) {
      accumulator.set(key, [])
    }

    accumulator.get(key).push(row)
    return accumulator
  }, new Map())

  return Array.from(groups.values()).map(summarizePositionGroup)
}

export function parseBrokerImport(text) {
  const rows = parseCsv(text)
  const fileType = detectFileType(rows)

  if (fileType === 'position-history') {
    const mappedRows = mapPositionHistoryRows(rows)
    return {
      fileType,
      rows: mappedRows,
      message: `Position History.csv rilevato: ${mappedRows.length} trade aggregati per Position ID.`,
    }
  }

  if (fileType === 'orders') {
    return {
      fileType,
      rows: [],
      message: 'Orders.csv rilevato: contiene ordini grezzi e cancellazioni. Per import automatico usa Position History.csv.',
    }
  }

  return {
    fileType,
    rows: [],
    message: 'Formato file non riconosciuto.',
  }
}
