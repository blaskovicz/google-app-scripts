// https://developers.google.com/apps-script/guides/triggers/events
// Range object: https://developers.google.com/apps-script/reference/spreadsheet/range
function onEdit(e) {
  updateCostBreakdown(e);
}

function parseYear(rawDate) {
  const typ = typeof rawDate;
  if (typ === 'number') {
    if (rawDate >= 2018 && rawDate < 3000) {
      return rawDate;
    }
    return null;
  }


  if (typ === 'object' && rawDate instanceof Date) {
    return rawDate.getFullYear();
  }

  if (typ !== 'string' || rawDate.length < 4) {
    Logger.log("level=warn date '%s' was a %s", rawDate, typ)
    return null;
  }
  
  if (rawDate.length === 4) {
    const d = +rawDate;
    if (isNaN(d) || d < 2018) {
      return null;
    }
    return d;
  }

  const d = new Date(d);
  return d.getFullYear();
}

function parseCost(rawCost) {
  if (typeof rawCost === 'string' && rawCost === '') {
    return null;
  }

  if (rawCost === '-') {
    return 0;
  }

  const c = +rawCost;
  if(isNaN(c) || c < 0) {
    return null;
  }
  return c;
}
  
// function isTruthy(value) {
//   if (typeof value === 'string') {
//     return value === 'y' || value === 'yes' || value === 't' || value === 'true';
//   }
//   return !!value;
// }

function parseCostsFromSheet(sheet, costs, costColIndex, dateColIndex) {
  const category = sheet.getName();
  const expenseRange = sheet.getDataRange();
  const expenses = expenseRange.getValues();

  // skip first row, title row
  for (var i = 1; i < expenses.length; i++) {
    const expenseRow = expenses[i];

    // cells are relative in a range, with 1, 1 being the top-left index of the range, so add 1 for offset
    const alertRange = expenseRange.getCell(i+1, costColIndex+1);
    
    alertRange.clearFormat();

    var [ workYear, cost ]  = [ parseYear(expenseRow[dateColIndex]), parseCost(expenseRow[costColIndex]) ];

    if (workYear === null || cost === null) {
      Logger.log("level=warn category='%s' skipping year=%s cost=%s row=%s", category, workYear, cost, JSON.stringify(expenseRow));
      continue;
    }

    // TODO: bucket based on affect versus overall hard cut-off
    // TODO: make this a callback
    if (cost >= 1000.0) {
      // mark cost based on criteria
      alertRange.setBackground('red');
    } else if (cost >= 500) {
      alertRange.setBackground('orange');
    }

    costs[workYear] = (costs[workYear] || {});
    costs[workYear][category] = (costs[workYear][category] || 0) + cost;
  }
}

function updateCostBreakdown(e) {
  if (e == null || e.source == null) {
    Logger.log("level=warn missing event data");
    return;
  }
  
  const sheets /* Sheet[] */ = e.source.getSheets();
  const uAndRSheet = sheets[0]; // Upgrade, Repair, Maintenance (tab 1)
  const oilSheet = sheets[1]; // Oil (tab 2)
  const cbSheet = sheets[sheets.length - 1]; // Cost Breakdown (last tab)

  const costs = {};
  const categories = [uAndRSheet.getName(), oilSheet.getName()];
  const categoryColumnFurthest = 'C';

  /** parseCostsFromSheet(sheet, costs, costColIndex, dateColIndex) */
  parseCostsFromSheet(uAndRSheet, costs, 4, 1);
  parseCostsFromSheet(oilSheet, costs, 1, 0);
  
  // Logger.log(costs);

  // descending sort
  const years = Object.keys(costs).sort((a, b) => b-a);
  const fillerCols = categories.map(() => '');

  const newCostData = [
    ['Yearly Cost by Sheet', ...fillerCols],
    ['Year', ...categories],
  ];
  const headerRowCount = newCostData.length;
  const newDataRange = 'A1:'+categoryColumnFurthest+(headerRowCount+years.length).toString()

  for (const year of years) {
    const categoryInfo = costs[year];
    const row = [year];
    for (const category of categories) {
      const categoryYearCost = categoryInfo[category] || 0;
      row.push('$'+categoryYearCost);
    }
    newCostData.push(row);
  }

  Logger.log(newDataRange);
  Logger.log(newCostData);

  cbSheet
    .getRange(newDataRange)
    .setValues(newCostData)
    .clearFormat();
}
