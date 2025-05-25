import type { DifficultyType } from "./difficultyType";

export type RecordConstsType = {
	title: string;
	consts: Record<DifficultyType, number | undefined>;
};
