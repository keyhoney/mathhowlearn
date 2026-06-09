import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AstroConfig } from 'astro';
import type { Loader, LoaderContext } from 'astro/loaders';

type EntryType = {
  getEntryInfo: (args: {
    contents: string;
    fileUrl: URL;
  }) => Promise<{ data: Record<string, unknown>; body: string }>;
  getRenderFunction?: (config: AstroConfig) => Promise<
    | ((args: {
        id: string;
        data: Record<string, unknown>;
        body: string;
        filePath: string;
        digest: string;
      }) => Promise<{ metadata?: { imagePaths?: string[] } } | undefined>)
    | undefined
  >;
  contentModuleTypes?: unknown;
};

type Ctx = LoaderContext & { entryTypes: Map<string, EntryType> };

function posixRelative(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join('/');
}

function normalizeProblemMeta(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (out.examType === '모평') out.examType = '모의평가';
  return out;
}

/**
 * MDX 파일(본문) + 동일 폴더의 JSON 레지스트리(메타데이터)를 합쳐 한 항목으로 적재한다.
 * 병합 규칙: 레지스트리 값이 프론트매터보다 우선(본문만 두고 메타는 JSON에만 두는 용도).
 */
export function problemMdxRegistryLoader(opts: {
  /** 프로젝트 루트 기준, 예: src/content/problems */
  collectionDir: string;
  /** collectionDir 안의 파일명, 예: _metadata.json */
  registryFile: string;
}): Loader {
  const name = `mdx-registry-${opts.collectionDir.replace(/[^\w-]+/g, '_')}`;
  return {
    name,
    load: async (context: LoaderContext) => {
      const { store, logger, parseData, generateDigest, config, watcher } = context;
      const entryTypes = (context as Ctx).entryTypes;

      const rootDir = fileURLToPath(config.root);
      const baseDir = path.join(rootDir, opts.collectionDir);
      const registryPath = path.join(baseDir, opts.registryFile);

      if (!existsSync(baseDir)) {
        logger.warn(`problemMdxRegistryLoader: missing directory ${baseDir}`);
        return;
      }
      if (!existsSync(registryPath)) {
        logger.error(`problemMdxRegistryLoader: missing registry ${registryPath}`);
        return;
      }

      const entryType = entryTypes.get('.mdx');
      if (!entryType) {
        logger.error('problemMdxRegistryLoader: no .mdx entry type registered');
        return;
      }

      const renderCache = new WeakMap<
        EntryType,
        Awaited<ReturnType<NonNullable<EntryType['getRenderFunction']>>>
      >();

      let registry: Record<string, Record<string, unknown>> = {};

      async function readRegistry(): Promise<void> {
        const raw = await fs.readFile(registryPath, 'utf-8');
        // Some editors/tools may save JSON with UTF-8 BOM.
        const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
        registry = JSON.parse(cleaned) as Record<string, Record<string, unknown>>;
      }

      async function syncOne(fileName: string, untouched: Set<string>): Promise<void> {
        const id = path.basename(fileName, '.mdx');
        const fullPath = path.join(baseDir, fileName);
        const fileUrl = pathToFileURL(fullPath);
        const contents = await fs.readFile(fullPath, 'utf-8');
        const fileMetaRaw = registry[id];
        const fileMeta = fileMetaRaw ? normalizeProblemMeta(fileMetaRaw) : undefined;
        if (!fileMeta) {
          logger.error(
            `problemMdxRegistryLoader: "${id}" has no entry in ${opts.registryFile}`,
          );
          return;
        }

        const { body, data: fmData } = await entryType.getEntryInfo({
          contents,
          fileUrl,
        });

        const mergedData: Record<string, unknown> = { ...fmData, ...fileMeta };

        const digest = generateDigest(JSON.stringify(fileMeta) + '\n' + contents);
        const filePathAbs = fileURLToPath(fileUrl);
        const relativePath2 = posixRelative(rootDir, filePathAbs);

        untouched.delete(id);

        const parsedData = await parseData({
          id,
          data: mergedData,
          filePath: filePathAbs,
        });

        if (entryType.getRenderFunction) {
          let render = renderCache.get(entryType);
          if (!render) {
            render = await entryType.getRenderFunction(config);
            renderCache.set(entryType, render);
          }
          let rendered: { metadata?: { imagePaths?: string[] } } | undefined;
          try {
            rendered = await render?.({
              id,
              data: mergedData,
              body,
              filePath: filePathAbs,
              digest,
            });
          } catch (error: unknown) {
            const err = error as Error;
            logger.error(`Error rendering ${fileName}: ${err.message}`);
          }
          store.set({
            id,
            data: parsedData,
            body,
            filePath: relativePath2,
            digest,
            rendered,
            assetImports: rendered?.metadata?.imagePaths,
          });
        } else if ('contentModuleTypes' in entryType && entryType.contentModuleTypes) {
          store.set({
            id,
            data: parsedData,
            body,
            filePath: relativePath2,
            digest,
            deferredRender: true,
          });
        } else {
          store.set({
            id,
            data: parsedData,
            body,
            filePath: relativePath2,
            digest,
          });
        }
      }

      async function resyncAll(): Promise<void> {
        await readRegistry();
        const mdxFiles = (await fs.readdir(baseDir)).filter(
          (f) => f.endsWith('.mdx') && !f.startsWith('_'),
        );
        const untouched = new Set(store.keys());
        for (const f of mdxFiles) {
          await syncOne(f, untouched);
        }
        untouched.forEach((id) => store.delete(id));
      }

      await resyncAll();

      if (!watcher) return;

      watcher.add(baseDir);
      watcher.add(registryPath);

      const onChange = async (changedPath: string) => {
        const norm = path.normalize(changedPath);
        if (norm === path.normalize(registryPath)) {
          try {
            await resyncAll();
            logger.info(`Reloaded ${opts.registryFile}`);
          } catch (e: unknown) {
            const err = e as Error;
            logger.error(`Registry reload failed: ${err.message}`);
          }
          return;
        }
        if (!norm.endsWith('.mdx') || path.basename(norm).startsWith('_')) return;
        if (path.normalize(path.dirname(norm)) !== path.normalize(baseDir)) return;
        try {
          await syncOne(path.basename(norm), new Set());
          logger.info(`Reloaded ${path.basename(norm)}`);
        } catch (e: unknown) {
          const err = e as Error;
          logger.error(`Reload failed: ${err.message}`);
        }
      };

      watcher.on('change', onChange);
      watcher.on('add', onChange);
      watcher.on('unlink', async (deletedPath: string) => {
        const norm = path.normalize(deletedPath);
        if (path.normalize(path.dirname(norm)) !== path.normalize(baseDir)) return;
        if (!norm.endsWith('.mdx')) return;
        const id = path.basename(norm, '.mdx');
        store.delete(id);
      });
    },
  };
}
