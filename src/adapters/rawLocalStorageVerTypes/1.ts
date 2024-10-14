export type RawLocalStorageVer1Type = {
	version: 1;
	progresses: Array<{
		createdAt: number;
		message: string;
		type: "progress" | "error" | "finished";
	}>;
	outputTargetOptions: {
		dropbox: {
			outputPath: string;
			accessToken?: string;
			expires?: number;
		};
	};
};
