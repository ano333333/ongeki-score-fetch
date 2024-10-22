import { LocalStorage } from "./adapters/localStorage";
import MockOutputTargetFactory from "./adapters/outputTargetFactory/mockOutputTargetFactory";
import type { OutputTargetDataRowType } from "./adapters/outputTargetType";
import { ChrExtLocalStorage } from "./adapters/rawLocalStorage/chrExtLocalStorage";
import type { ChrExtRuntimeMessageType } from "./messages";

const localStorage = new LocalStorage(new ChrExtLocalStorage());
const outputTargetFactory = new MockOutputTargetFactory();

chrome.runtime.onMessage.addListener(
	(message: ChrExtRuntimeMessageType, _, sendResponse) => {
		if (message.to !== "backgroundWorker") {
			return;
		}
		console.log("backgroundWorker: received message", message);
		if (message.type === "is-fetch-processing") {
			handleIsFetchProcessing().then((res) => sendResponse(res));
			return true;
		}
		if (message.type === "start-fetch") {
			handleStartFetch();
		}
		if (message.type === "save-fetch-log") {
			handleSaveFetchLog(message);
		}
		if (message.type === "fetch-finished") {
			handleFetchFinished(message);
		}
	},
);

async function handleIsFetchProcessing() {
	console.log(
		"backgroundWorker: isFetchProcessing",
		await chrome.offscreen.hasDocument(),
	);
	return await chrome.offscreen.hasDocument();
}

async function handleStartFetch() {
	await localStorage.clearProgresses();
	await chrome.offscreen.createDocument({
		url: chrome.runtime.getURL("offscreenDataFetch.html"),
		reasons: [
			chrome.offscreen.Reason.DOM_SCRAPING,
			chrome.offscreen.Reason.DOM_PARSER,
		],
		justification: "for fetching datas and parse DOM",
	});
	console.log("backgroundWorker: created offscreen document");
	const newMessage: ChrExtRuntimeMessageType = {
		type: "start-fetch",
		from: "backgroundWorker",
		to: "offscreenDataFetch",
	};
	chrome.runtime.sendMessage(newMessage);
}

async function handleSaveFetchLog(message: {
	logType: "progress" | "error" | "finish";
	logMessage: string;
}) {
	await localStorage.appendProgresses({
		createdAt: Date.now(),
		type: message.logType,
		message: message.logMessage,
	});
}

async function handleFetchFinished(message: {
	datas?: OutputTargetDataRowType[];
	error?: string;
}) {
	if (message.datas) {
		const logger = async (message: string) => {
			await localStorage.appendProgresses({
				createdAt: Date.now(),
				type: "progress",
				message,
			});
		};
		try {
			const outputMethod = await localStorage.getOutputTarget();
			const outputTargetOptions = await localStorage.getOutputTargetOptions();
			if (outputMethod === "download") {
				const outputTarget = outputTargetFactory.getDownloadOutputTarget();
				await outputTarget(message.datas, void 0, logger);
			} else if (outputMethod === "dropbox") {
				const outputTarget = outputTargetFactory.getDropboxOutputTarget();
				const newDropboxOption = await outputTarget(
					message.datas,
					outputTargetOptions.dropbox,
					logger,
				);
				await localStorage.setOutputTargetOptions({
					...outputTargetOptions,
					dropbox: newDropboxOption,
				});
			}
			await localStorage.appendProgresses({
				createdAt: Date.now(),
				type: "finish",
				message: "",
			});
		} catch (e) {
			if (typeof e === "string") {
				await localStorage.appendProgresses({
					createdAt: Date.now(),
					type: "error",
					message: e,
				});
			} else {
				await localStorage.appendProgresses({
					createdAt: Date.now(),
					type: "error",
					message: "不明なエラー",
				});
			}
		}
	} else if (message.error) {
		await localStorage.appendProgresses({
			createdAt: Date.now(),
			type: "error",
			message: message.error,
		});
	}
	await chrome.offscreen.closeDocument();
}
