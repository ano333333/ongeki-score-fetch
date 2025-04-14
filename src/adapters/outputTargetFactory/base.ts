import type { OutputTargetType } from "../outputTargetType";

export interface IOutputTargetFactory {
	getDownloadOutputTarget(): OutputTargetType<void>;
	getDropboxOutputTarget(): OutputTargetType<{
		outputPath: string;
		accessToken: string | undefined;
		expires: number | undefined;
	}>;
}
