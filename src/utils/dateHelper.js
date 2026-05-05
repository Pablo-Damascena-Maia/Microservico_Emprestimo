function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days));
  return result;
}

function diffDays(dateA, dateB) {
  const msA = new Date(dateA).getTime();
  const msB = new Date(dateB).getTime();
  return Math.ceil(Math.abs(msA - msB) / (1000 * 60 * 60 * 24));
}

module.exports = { addDays, diffDays };
