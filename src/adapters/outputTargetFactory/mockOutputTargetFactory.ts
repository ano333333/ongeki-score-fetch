import type { IOutputTargetFactory } from "./base";
import type { OutputTargetType } from "../outputTargetType";

export default class MockOutputTargetFactory implements IOutputTargetFactory {
	getDownloadOutputTarget(): OutputTargetType<void> {
		return async (datas, _, logger) => {
			await logger('MockOutputTargetFactory.getOutputTarget("download") start');
			for (let i = 0; i < 3; i++) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				await logger(`download ${i}/3`);
			}
			await logger('MockOutputTargetFactory.getOutputTarget("download") end');
			console.group('MockOutputTargetFactory.getOutputTarget("download")');
			console.log(datas);
			console.groupEnd();
		};
	}
	getDropboxOutputTarget(): OutputTargetType<{
		outputPath: string;
		accessToken: string | undefined;
		expires: number | undefined;
	}> {
		return async (datas, option, logger) => {
			await logger('MockOutputTargetFactory.getOutputTarget("dropbox") start');
			for (let i = 0; i < 3; i++) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				await logger(`dropbox ${i}/3`);
			}
			await logger('MockOutputTargetFactory.getOutputTarget("dropbox") end');
			console.group('MockOutputTargetFactory.getOutputTarget("dropbox")');
			console.dir(option, { depth: null });
			console.dir(datas, { depth: null });
			console.groupEnd();
			return option;
		};
	}
}
