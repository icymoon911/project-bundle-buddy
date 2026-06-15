const mb = 1024 * 1024;
const kb = 1024;

/**
 * Round a number to the given number of decimal places, compensating for
 * IEEE-754 floating-point representation errors that cause values like
 * 1.005 to be stored as 1.0049999… and then incorrectly rounded down by
 * toFixed.
 */
function preciseToFixed(num, decimals) {
  return (
    Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) /
    Math.pow(10, decimals)
  ).toFixed(decimals);
}

export function getFileSizeSplit(size) {
  if (!size || size === 0) return { size: 0, type: "KB" };
  let value = size && size >= mb ? size / mb : size / kb;
  if (value < 1 || size >= mb) value = preciseToFixed(value, 2);
  else value = preciseToFixed(value, 0);
  return { value, type: size >= mb ? "MB" : "KB" };
}

export function getFileSize(size) {
  const { value, type } = getFileSizeSplit(size);
  return `${value} ${type}`;
}

export const getPercent = (size, total) => {
  if (size === 1) return "100%";
  let rounded = size <= 1 ? size * 100 : (size / total) * 100;

  if (rounded < 0.1) rounded = "<.1";
  else if (rounded >= 99.5) rounded = rounded.toFixed(1);
  else if (rounded < 1) rounded = rounded.toFixed(1);
  else rounded = rounded.toFixed(0);

  rounded = rounded + "%";

  if (rounded === "1.0%") rounded = "1%";
  if (rounded.slice(0, 2) === "0.") rounded = rounded.slice(1);

  return rounded;
};

export const getCSSPercent = (size, total) => {
  if (size === 1) return "100%";

  let rounded = size <= 1 ? size * 100 : (size / total) * 100;

  if (rounded < 0.1) rounded = ".1";
  else if (rounded >= 99.5) rounded = rounded.toFixed(1);
  else if (rounded < 1) rounded = rounded.toFixed(1);
  else rounded = rounded.toFixed(0);

  rounded = rounded + "%";

  if (rounded === "1.0%") rounded = "1%";
  if (rounded.slice(0, 2) === "0.") rounded = rounded.slice(1);

  return rounded;
};
