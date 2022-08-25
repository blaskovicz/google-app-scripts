// https://developers.google.com/apps-script/guides/triggers/events
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

function updateCostBreakdown(e) {
  if (e == null || e.source == null) {
    Logger.log("level=warn missing event data");
    return;
  }
  
  const sheets /* Sheet[] */ = e.source.getSheets();

  // for (const sheet of sheets) {
  //   Logger.log(sheet.getName());
  // }

  const uAndRSheet = sheets[0]; // Upgrade, Repair, Maintenance (tab 1)
  // TODO: calculate other sheets into final cost breakdown like oil, electric, etc
  const cbSheet = sheets[sheets.length - 1]; // Cost Breakdown (last tab)
  
  const uAndRExpenses = uAndRSheet.getDataRange().getValues();
  const costs = {};

  for (var i = 1; i < uAndRExpenses.length; i++) {
    const expenseRow = uAndRExpenses[i];
    var [ workYear, cost ]  = [ parseYear(expenseRow[1]), parseCost(expenseRow[4]) ];

    if (workYear === null || cost === null) {
      Logger.log("Skipping year=%s cost=%s row=%s", workYear, cost, JSON.stringify(expenseRow));
      continue;
    }

    costs[workYear] = (costs[workYear] || 0) + cost;
  }
 
  Logger.log(costs);

  cbSheet
    .getRange('A1').setValue("Year");
  cbSheet
    .getRange("B1").setValue("Cost");

  // descending sort
  const years = Object.keys(costs).sort((a, b) => b-a);
  let total = 0.0

  years.push("Total");

  for (var i = 0; i < years.length; i++) {
    const year = years[i];
    let yearCost = costs[year];
    
    if (yearCost !== undefined) {
      total += yearCost;
    } else {
      yearCost = total;
    }
    
    const row = i+2;

    cbSheet
      .getRange('A' + row).setValue(year);
    cbSheet
      .getRange('B' + row).setValue("$"+yearCost);
  }
}
