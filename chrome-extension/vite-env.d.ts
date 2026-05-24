/// <reference types="vite/client" />

interface ViteTypeOptions {
	strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
	readonly VITE_BEATMAP_DATA_BUCKET_URL: string;
	readonly VITE_USER_NAME: string;
	readonly VITE_USER_PASSWORD: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
