// A form entry can be a File; only a string is accepted as text input.
const readFormText = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

export { readFormText };
