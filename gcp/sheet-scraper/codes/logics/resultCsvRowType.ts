import type { DifficultyType } from "./difficultyType";

export type ResultCsvRowType = {
	title: string;
	genre: string;
	character: string;
	versionMaster: string | undefined;
	versionLunatic: string | undefined;
	constants: Record<DifficultyType, number | undefined>;
};
