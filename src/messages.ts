import type { OutputTargetDataRowType } from "./adapters/outputTargetType";

export type ChrExtRuntimeMessageType =
	| {
			type: "is-fetch-processing";
			from: "popup";
			to: "backgroundWorker";
	  }
	| {
			type: "start-fetch";
			from: "popup";
			to: "backgroundWorker";
	  }
	| {
			type: "start-fetch";
			from: "backgroundWorker";
			to: "offscreenDataFetch";
	  }
	| {
			type: "save-fetch-log";
			from: "offscreenDataFetch";
			to: "backgroundWorker";
			logType: "progress" | "error" | "finish";
			logMessage: string;
	  }
	| {
			type: "fetch-finished";
			from: "offscreenDataFetch";
			to: "backgroundWorker";
			datas: OutputTargetDataRowType[];
			error?: string;
	  };
