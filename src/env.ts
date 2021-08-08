/**
 * Returns the value of environment variable `name`.
 * Throws Error if undefined.
 * @param name - name of environment variable.
 */
export const env = (name: string): string => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${name}.`);
  }
  return value;
};
