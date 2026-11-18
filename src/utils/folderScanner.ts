import * as XLSX from 'xlsx';

const SUPPORTED_EXTENSIONS = ['.csv', '.txt', '.xlsx', '.xls'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.bmp'];
const IGNORED_FOLDERS = new Set(['node_modules', '.git', '.vscode', '.idea', '__macosx']);

export interface ScannedObraFolder {
  folderName: string;
  files: File[];
  logoFile?: File;
}

export function isSupportedSpreadsheetFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.startsWith('~$')) return false; // Ignore Excel temporary lock files
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function isLogoImageFile(filename: string): boolean {
  const lower = filename.toLowerCase().trim();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot === -1) return false;
  const baseName = lower.slice(0, lastDot);
  const ext = lower.slice(lastDot);
  return baseName === 'logo' && IMAGE_EXTENSIONS.includes(ext);
}

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Error reading logo image'));
    reader.readAsDataURL(file);
  });
}

export async function readSpreadsheetFileAsText(file: File): Promise<string> {
  try {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      return XLSX.utils.sheet_to_csv(sheet);
    }

    const textUtf8 = await file.text();
    if (textUtf8.includes('\uFFFD')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file, 'ISO-8859-1');
      });
    }
    return textUtf8;
  } catch {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'ISO-8859-1');
    });
  }
}

/**
 * Groups a FileList from <input type="file" webkitdirectory /> into ScannedObraFolder[].
 * Supports either:
 * - Selecting the parent folder "calculadora" containing subfolders "MASA/", "PAE/", etc.
 * - Selecting a single obra folder directly (e.g. "MASA/") containing CSV/Excel files and optional "logo.*".
 */
export function groupDirectoryInputFiles(fileList: FileList | File[]): ScannedObraFolder[] {
  const files = Array.from(fileList);
  const relevantFiles = files.filter(
    f => isSupportedSpreadsheetFile(f.name) || isLogoImageFile(f.name)
  );

  if (relevantFiles.length === 0) return [];

  // Check if there are nested subfolder files (webkitRelativePath has >= 3 segments: root/obra/file)
  const hasNestedSubfolders = relevantFiles.some(f => {
    const rel = f.webkitRelativePath || f.name;
    const segments = rel.split('/').filter(Boolean);
    return segments.length >= 3;
  });

  const folderMap = new Map<string, { files: File[]; logoFile?: File }>();

  for (const file of relevantFiles) {
    const rel = file.webkitRelativePath || file.name;
    const segments = rel.split('/').filter(Boolean);

    let targetFolderName: string;
    if (hasNestedSubfolders) {
      if (segments.length >= 3) {
        targetFolderName = segments[1];
      } else {
        targetFolderName = segments[0] || 'General';
      }
    } else {
      targetFolderName = segments.length >= 2 ? segments[0] : 'Obra Importada';
    }

    if (IGNORED_FOLDERS.has(targetFolderName.toLowerCase())) continue;

    if (!folderMap.has(targetFolderName)) {
      folderMap.set(targetFolderName, { files: [] });
    }
    const bucket = folderMap.get(targetFolderName)!;

    if (isLogoImageFile(file.name)) {
      // Prefer top-level logo inside the obra folder if multiple exist
      if (!bucket.logoFile || segments.length <= 3) {
        bucket.logoFile = file;
      }
    } else if (isSupportedSpreadsheetFile(file.name)) {
      bucket.files.push(file);
    }
  }

  return Array.from(folderMap.entries())
    .filter(([, data]) => data.files.length > 0 || data.logoFile !== undefined)
    .map(([folderName, data]) => ({
      folderName,
      files: data.files.sort((a, b) => a.name.localeCompare(b.name)),
      logoFile: data.logoFile,
    }))
    .sort((a, b) => a.folderName.localeCompare(b.folderName));
}

// --- Drag & Drop Directory Traversal Helpers (webkitGetAsEntry) ---

function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const allEntries: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...entries);
            readBatch();
          }
        },
        (err) => reject(err)
      );
    };
    readBatch();
  });
}

function getFileFromEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function collectFilesRecursively(dirEntry: FileSystemDirectoryEntry): Promise<{
  directFiles: File[];
  directLogoFile?: File;
  subdirectories: { name: string; files: File[]; logoFile?: File }[];
}> {
  const entries = await readAllDirectoryEntries(dirEntry.createReader());
  const directFiles: File[] = [];
  let directLogoFile: File | undefined;
  const subdirectories: { name: string; files: File[]; logoFile?: File }[] = [];

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await getFileFromEntry(entry as FileSystemFileEntry);
      if (isLogoImageFile(file.name)) {
        directLogoFile = file;
      } else if (isSupportedSpreadsheetFile(file.name)) {
        directFiles.push(file);
      }
    } else if (entry.isDirectory) {
      if (IGNORED_FOLDERS.has(entry.name.toLowerCase())) continue;
      const nested = await collectAllFilesFlat(entry as FileSystemDirectoryEntry);
      subdirectories.push({
        name: entry.name,
        files: nested.files,
        logoFile: nested.logoFile,
      });
    }
  }

  return { directFiles, directLogoFile, subdirectories };
}

async function collectAllFilesFlat(dirEntry: FileSystemDirectoryEntry): Promise<{
  files: File[];
  logoFile?: File;
}> {
  const entries = await readAllDirectoryEntries(dirEntry.createReader());
  const files: File[] = [];
  let logoFile: File | undefined;

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await getFileFromEntry(entry as FileSystemFileEntry);
      if (isLogoImageFile(file.name)) {
        logoFile = file;
      } else if (isSupportedSpreadsheetFile(file.name)) {
        files.push(file);
      }
    } else if (entry.isDirectory && !IGNORED_FOLDERS.has(entry.name.toLowerCase())) {
      const sub = await collectAllFilesFlat(entry as FileSystemDirectoryEntry);
      files.push(...sub.files);
      if (!logoFile && sub.logoFile) {
        logoFile = sub.logoFile;
      }
    }
  }

  return { files, logoFile };
}

/**
 * Scans dragged & dropped folders/files from Windows Explorer / Finder.
 * Detects spreadsheets AND "logo.*" image files inside each obra folder.
 */
export async function scanDroppedItems(dataTransfer: DataTransfer): Promise<ScannedObraFolder[]> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries = items
    .map(item => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.length === 0) {
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      return groupDirectoryInputFiles(dataTransfer.files);
    }
    return [];
  }

  const dirEntries = entries.filter((e): e is FileSystemDirectoryEntry => e.isDirectory);
  const fileEntries = entries.filter((e): e is FileSystemFileEntry => e.isFile);

  const resultMap = new Map<string, { files: File[]; logoFile?: File }>();

  if (dirEntries.length === 1 && fileEntries.length === 0) {
    const rootDir = dirEntries[0];
    const { directFiles, directLogoFile, subdirectories } = await collectFilesRecursively(rootDir);
    const hasSubdirsWithContent = subdirectories.some(s => s.files.length > 0 || s.logoFile !== undefined);

    if (hasSubdirsWithContent || (directFiles.length === 0 && !directLogoFile && subdirectories.length > 0)) {
      // Parent folder mode (e.g. "calculadora"): each subdirectory is an obra
      for (const sub of subdirectories) {
        resultMap.set(sub.name, {
          files: sub.files.sort((a, b) => a.name.localeCompare(b.name)),
          logoFile: sub.logoFile,
        });
      }
      if (directFiles.length > 0) {
        resultMap.set(rootDir.name, {
          files: directFiles.sort((a, b) => a.name.localeCompare(b.name)),
          logoFile: directLogoFile,
        });
      }
    } else {
      // Single obra folder mode (e.g. "MASA" with CSVs + optional logo directly inside)
      resultMap.set(rootDir.name, {
        files: directFiles.sort((a, b) => a.name.localeCompare(b.name)),
        logoFile: directLogoFile,
      });
    }
  } else {
    for (const dir of dirEntries) {
      if (IGNORED_FOLDERS.has(dir.name.toLowerCase())) continue;
      const scanned = await collectAllFilesFlat(dir);
      resultMap.set(dir.name, {
        files: scanned.files.sort((a, b) => a.name.localeCompare(b.name)),
        logoFile: scanned.logoFile,
      });
    }

    if (fileEntries.length > 0) {
      const looseFiles: File[] = [];
      let looseLogo: File | undefined;
      for (const fe of fileEntries) {
        const f = await getFileFromEntry(fe);
        if (isLogoImageFile(f.name)) looseLogo = f;
        else if (isSupportedSpreadsheetFile(f.name)) looseFiles.push(f);
      }
      if (looseFiles.length > 0) {
        const defaultName = looseFiles[0].name.replace(/\.[^/.]+$/, '');
        resultMap.set(defaultName, { files: looseFiles, logoFile: looseLogo });
      }
    }
  }

  return Array.from(resultMap.entries())
    .map(([folderName, data]) => ({
      folderName,
      files: data.files,
      logoFile: data.logoFile,
    }))
    .sort((a, b) => a.folderName.localeCompare(b.folderName));
}
