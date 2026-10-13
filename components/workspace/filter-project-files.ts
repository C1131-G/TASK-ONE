import type {
  FileSort,
  ProjectFile,
} from "@/components/workspace/project-file-types";

export const filterProjectFiles = (
  files: readonly ProjectFile[],
  query: string,
  typeFilter: string,
  sort: FileSort
) => {
  const fileTypes = [
    ...new Set(files.map(({ contentType }) => contentType)),
  ].toSorted((left, right) => left.localeCompare(right));
  const filteredFiles = files
    .filter((file) => {
      const matchesQuery = `${file.originalName} ${file.contentType}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase());
      const matchesType =
        typeFilter === "all" || file.contentType === typeFilter;
      return matchesQuery && matchesType;
    })
    .toSorted((left, right) => {
      if (sort === "name") {
        return left.originalName.localeCompare(right.originalName);
      }
      if (sort === "size") {
        return right.sizeBytes - left.sizeBytes;
      }
      const dateOrder = left.createdAt.localeCompare(right.createdAt);
      return sort === "newest" ? -dateOrder : dateOrder;
    });
  return { fileTypes, filteredFiles };
};
