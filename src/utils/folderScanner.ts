import * as XLSX from 'xlsx';

const SUPPORTED_EXTENSIONS = ['.csv', '.txt', '.xlsx', '.xls'];
const IGNORED_FOLDERS = new Set(['node_modules', '.git', '.vscode', '.idea', '__macosx']);

export interface ScannedObraFolder {
  folderName: string;
  files: File[];
}

export function isSupportedSpreadsheetFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.startsWith('~$')) return false; // Ignore Excel temporary lock files
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
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
 * - Selecting a single obra folder directly (e.g. "MASA/") containing CSV/Excel files.
 */
export function groupDirectoryInputFiles(fileList: FileList | File[]): ScannedObraFolder[] {
  const files = Array.from(fileList);
  const validFiles = files.filter(f => isSupportedSpreadsheetFile(f.name));

  if (validFiles.length === 0) return [];

  // Check if there are nested subfolder files (webkitRelativePath has >= 3 segments: root/obra/file.csv)
  const hasNestedSubfolders = validFiles.some(f => {
    const rel = f.webkitRelativePath || f.name;
    const segments = rel.split('/').filter(Boolean);
    return segments.length >= 3;
  });

  const folderMap = new Map<string, File[]>();

  for (const file of validFiles) {
    const rel = file.webkitRelativePath || file.name;
    const segments = rel.split('/').filter(Boolean);

    let targetFolderName: string;
    if (hasNestedSubfolders) {
      if (segments.length >= 3) {
        targetFolderName = segments[1];
      } else {
        // Loose file directly inside the root folder
        targetFolderName = segments[0] || 'General';
      }
    } else {
      // User selected a single obra folder directly (e.g. MASA/file.csv)
      targetFolderName = segments.length >= 2 ? segments[0] : 'Obra Importada';
    }

    if (IGNORED_FOLDERS.has(targetFolderName.toLowerCase())) continue;

    if (!folderMap.has(targetFolderName)) {
      folderMap.set(targetFolderName, []);
    }
    folderMap.get(targetFolderName)!.push(file);
  }

  return Array.from(folderMap.entries())
    .map(([folderName, folderFiles]) => ({
      folderName,
      files: folderFiles.sort((a, b) => a.name.localeCompare(b.name)),
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
  subdirectories: { name: string; files: File[] }[];
}> {
  const entries = await readAllDirectoryEntries(dirEntry.createReader());
  const directFiles: File[] = [];
  const subdirectories: { name: string; files: File[] }[] = [];

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await getFileFromEntry(entry as FileSystemFileEntry);
      if (isSupportedSpreadsheetFile(file.name)) {
        directFiles.push(file);
      }
    } else if (entry.isDirectory) {
      if (IGNORED_FOLDERS.has(entry.name.toLowerCase())) continue;
      const nested = await collectAllFilesFlat(entry as FileSystemDirectoryEntry);
      subdirectories.push({
        name: entry.name,
        files: nested,
      });
    }
  }

  return { directFiles, subdirectories };
}

async function collectAllFilesFlat(dirEntry: FileSystemDirectoryEntry): Promise<File[]> {
  const entries = await readAllDirectoryEntries(dirEntry.createReader());
  const files: File[] = [];

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await getFileFromEntry(entry as FileSystemFileEntry);
      if (isSupportedSpreadsheetFile(file.name)) {
        files.push(file);
      }
    } else if (entry.isDirectory && !IGNORED_FOLDERS.has(entry.name.toLowerCase())) {
      const subFiles = await collectAllFilesFlat(entry as FileSystemDirectoryEntry);
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * Scans dragged & dropped folders/files from Windows Explorer / Finder.
 * - If user drops a parent folder (e.g. "calculadora") with subfolders ("MASA", "PAE"),
 *   returns one ScannedObraFolder per subfolder!
 * - If user drops multiple obra folders together ("MASA", "PAE"), returns one per dropped folder.
 * - If user drops a single obra folder directly containing CSVs (no subfolders), returns that single folder.
 */
export async function scanDroppedItems(dataTransfer: DataTransfer): Promise<ScannedObraFolder[]> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries = items
    .map(item => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.length === 0) {
    // Fallback if browser does not expose webkitGetAsEntry
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      return groupDirectoryInputFiles(dataTransfer.files);
    }
    return [];
  }

  const dirEntries = entries.filter((e): e is FileSystemDirectoryEntry => e.isDirectory);
  const fileEntries = entries.filter((e): e is FileSystemFileEntry => e.isFile);

  const resultMap = new Map<string, File[]>();

  if (dirEntries.length === 1 && fileEntries.length === 0) {
    // Single folder dropped: could be root "calculadora" (with subfolders) OR a single obra "MASA"
    const rootDir = dirEntries[0];
    const { directFiles, subdirectories } = await collectFilesRecursively(rootDir);
    const hasSubdirsWithSpreadsheets = subdirectories.some(s => s.files.length > 0);

    if (hasSubdirsWithSpreadsheets || (directFiles.length === 0 && subdirectories.length > 0)) {
      // Parent folder mode (e.g. "calculadora"): each subdirectory is an obra!
      for (const sub of subdirectories) {
        resultMap.set(sub.name, sub.files.sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (directFiles.length > 0) {
        resultMap.set(rootDir.name, directFiles.sort((a, b) => a.name.localeCompare(b.name)));
      }
    } else {
      // Single obra folder mode (e.g. "MASA" with CSVs directly inside)
      resultMap.set(rootDir.name, directFiles.sort((a, b) => a.name.localeCompare(b.name)));
    }
  } else {
    // Multiple folders dropped together, or mix of folders and files
    for (const dir of dirEntries) {
      if (IGNORED_FOLDERS.has(dir.name.toLowerCase())) continue;
      const files = await collectAllFilesFlat(dir);
      resultMap.set(dir.name, files.sort((a, b) => a.name.localeCompare(b.name)));
    }

    if (fileEntries.length > 0) {
      const looseFiles: File[] = [];
      for (const fe of fileEntries) {
        const f = await getFileFromEntry(fe);
        if (isSupportedSpreadsheetFile(f.name)) looseFiles.push(f);
      }
      if (looseFiles.length > 0) {
        const defaultName = looseFiles[0].name.replace(/\.[^/.]+$/, '');
        resultMap.set(defaultName, looseFiles);
      }
    }
  }

  return Array.from(resultMap.entries())
    .map(([folderName, files]) => ({ folderName, files }))
    .sort((a, b) => a.folderName.localeCompare(b.folderName));
}
