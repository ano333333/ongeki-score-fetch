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

export const defaultRawLocalStorageVer1 = {
	version: 1,
	progresses: [],
	outputTargetOptions: {
		dropbox: {
			outputPath: "ongeki-score-fetch/data.csv",
		},
	},
};
