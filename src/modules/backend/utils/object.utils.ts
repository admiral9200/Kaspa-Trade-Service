export const isEmpty = (obj: object) => {
  return Object.keys(obj).length === 0;
};

export const isEmptyString = (str: string | null): boolean => {
  return !str || str.trim() === '';
};
