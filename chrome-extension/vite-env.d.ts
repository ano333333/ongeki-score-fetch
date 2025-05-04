/// <reference types="vite/client" />

interface ViteTypeOptions {
	strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
	readonly VITE_BEATMAP_DATA_SOURCE_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
